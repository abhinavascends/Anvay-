import type { IncidentSeverity, IncidentType } from "@/types/database";

// ============================================================
// AI report classification (Gemini) with rule-based fallback.
//
// Input:  free-text citizen report
// Output: hazard type, severity, people affected, required capabilities
//
// The AI assists; it never blocks. If the API is unavailable or the
// response is malformed we degrade to keyword heuristics.
// ============================================================

export interface Classification {
  type: IncidentType;
  severity: IncidentSeverity;
  peopleAffected: number | null;
  requiredCapabilities: string[];
  classifiedBy: "AI" | "RULES";
}

const VALID_TYPES: IncidentType[] = [
  "FLOOD",
  "FIRE",
  "LANDSLIDE",
  "STRUCTURAL_COLLAPSE",
  "MEDICAL_EMERGENCY",
  "EARTHQUAKE",
  "CYCLONE",
  "OTHER",
];
const VALID_SEVERITIES: IncidentSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const VALID_CAPS = ["BOAT", "MEDICAL", "HEAVY_EQUIPMENT", "GENERAL"];

const PROMPT = `You are a disaster-response triage classifier for an Indian city control room.
Classify this citizen report. Respond ONLY with JSON:
{
  "type": one of ${VALID_TYPES.join("|")},
  "severity": one of ${VALID_SEVERITIES.join("|")} (CRITICAL = life-threatening/trapped people, HIGH = danger developing, MEDIUM = disruption, LOW = informational),
  "peopleAffected": integer estimate or null,
  "requiredCapabilities": subset of [BOAT, MEDICAL, HEAVY_EQUIPMENT, GENERAL]
}
Report: """%s"""`;

export async function classifyReport(text: string): Promise<Classification> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || text.trim().length < 10) return heuristicClassify(text);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT.replace("%s", text) }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return heuristicClassify(text);

    const json = await res.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return heuristicClassify(text);

    const parsed = JSON.parse(raw);
    return {
      type: VALID_TYPES.includes(parsed.type) ? parsed.type : "OTHER",
      severity: VALID_SEVERITIES.includes(parsed.severity)
        ? parsed.severity
        : "MEDIUM",
      peopleAffected:
        Number.isInteger(parsed.peopleAffected) && parsed.peopleAffected > 0
          ? Math.min(9999, parsed.peopleAffected)
          : null,
      requiredCapabilities: Array.isArray(parsed.requiredCapabilities)
        ? parsed.requiredCapabilities.filter((c: string) => VALID_CAPS.includes(c))
        : [],
      classifiedBy: "AI",
    };
  } catch {
    return heuristicClassify(text);
  }
}

// ------------------------------------------------------------
// Deterministic fallback — no network, no API key needed.
// Same keyword approach as the SMS channel.
// ------------------------------------------------------------
export function heuristicClassify(text: string): Classification {
  const lower = text.toLowerCase();

  let peopleAffected: number | null = null;
  const countMatch =
    /\b(\d{1,4})\s*(?:people|persons|ppl|trapped|stuck|affected)/i.exec(text) ??
    /(?:people|persons|trapped)\s*[:\-]?\s*(\d{1,4})/i.exec(text);
  if (countMatch) peopleAffected = parseInt(countMatch[1], 10);

  const typeRules: [IncidentType, string[]][] = [
    ["MEDICAL_EMERGENCY", ["medical", "injur", "bleeding", "pregnan", "heart", "unconscious"]],
    ["STRUCTURAL_COLLAPSE", ["collapse", "rubble", "debris", "wall fell", "building fell"]],
    ["LANDSLIDE", ["landslide", "mudslide", "mud"]],
    ["FIRE", ["fire", "smoke", "burn", "blaze"]],
    ["EARTHQUAKE", ["earthquake", "quake", "tremor"]],
    ["CYCLONE", ["cyclone", "storm", "hurricane"]],
    ["FLOOD", ["flood", "water", "waterlog", "drown", "rain"]],
  ];
  let type: IncidentType = "OTHER";
  for (const [candidate, keywords] of typeRules) {
    if (keywords.some((kw) => lower.includes(kw))) {
      type = candidate;
      break;
    }
  }

  const criticalHints = ["trapped", "critical", "urgent", "unconscious", "collapse", "pregnan"];
  const highHints = ["rising", "cut off", "stranded", "injured", "heavy", "spreading"];
  let severity: IncidentSeverity;
  if (criticalHints.some((kw) => lower.includes(kw))) severity = "CRITICAL";
  else if (highHints.some((kw) => lower.includes(kw)) || (peopleAffected ?? 0) >= 10)
    severity = "HIGH";
  else if ((peopleAffected ?? 1) >= 4 || type !== "OTHER") severity = "MEDIUM";
  else severity = "LOW";

  const capabilities: string[] = [];
  if (["FLOOD", "CYCLONE"].includes(type)) capabilities.push("BOAT");
  if (type === "MEDICAL_EMERGENCY" || lower.includes("injur")) capabilities.push("MEDICAL");
  if (type === "STRUCTURAL_COLLAPSE") capabilities.push("HEAVY_EQUIPMENT");
  if (severity === "CRITICAL" && !capabilities.includes("MEDICAL")) capabilities.push("MEDICAL");
  if (capabilities.length === 0) capabilities.push("GENERAL");

  return {
    type,
    severity,
    peopleAffected,
    requiredCapabilities: capabilities,
    classifiedBy: "RULES",
  };
}
