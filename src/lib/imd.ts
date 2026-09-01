import type { AlertSeverity, AlertType } from "@/types/database";

// ============================================================
// IMD Weather Alert Integration
//
// Primary:  IMD API (api.imd.gov.in) - requires registration;
//           some endpoints need IP whitelisting.
// Fallback: last synced alerts stay in the DB; if the feed is
//           empty we generate a clearly-labelled demo warning so
//           the demo never depends on external uptime.
//
// Sync cadence: every 15 min from the dashboard client.
// ============================================================

const IMD_BASE = "https://api.imd.gov.in/api/v1";

export interface NormalizedAlert {
  alert_id: string;
  source: "IMD" | "MANUAL";
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string;
  affected_area: { lat: number; lng: number; radius_km: number } | null;
  effective_from: string;
  effective_until: string | null;
}

function mapSeverity(color: string): AlertSeverity {
  switch ((color ?? "").toUpperCase()) {
    case "RED":
      return "EXTREME";
    case "ORANGE":
      return "SEVERE";
    case "YELLOW":
      return "MODERATE";
    default:
      return "MINOR";
  }
}

function guessType(text: string): AlertType {
  const t = text.toLowerCase();
  if (t.includes("cyclone")) return "CYCLONE";
  if (t.includes("thunder")) return "THUNDERSTORM";
  if (t.includes("heat")) return "HEATWAVE";
  if (t.includes("flood")) return "FLOOD";
  if (t.includes("landslide")) return "LANDSLIDE";
  return "RAINFALL";
}

export async function fetchIMDAlerts(district = CITY.name): Promise<{
  alerts: NormalizedAlert[];
  live: boolean;
  source: "IMD" | "OPEN_METEO" | "DEMO";
}> {
  const key = process.env.IMD_API_KEY;

  // ---- Tier 1: Official IMD API (requires registered key) ----
  if (key) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `${IMD_BASE}/warnings/district?district=${encodeURIComponent(district)}`,
        { headers: { "x-api-key": key }, signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const warnings = Array.isArray(json) ? json : json?.warnings ?? [];
        if (warnings.length > 0) {
          return {
            live: true,
            source: "IMD",
            alerts: warnings.map((w: Record<string, unknown>, i: number) => ({
              alert_id: `IMD-${w.id ?? `${Date.now()}-${i}`}`,
              source: "IMD" as const,
              severity: mapSeverity(String(w.color ?? w.severity ?? "")),
              type: guessType(String(w.title ?? w.description ?? "")),
              title: String(w.title ?? `Weather warning - ${district}`),
              description: String(w.description ?? ""),
              affected_area: null,
              effective_from: new Date().toISOString(),
              effective_until: w.valid_upto
                ? new Date(String(w.valid_upto)).toISOString()
                : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            })),
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // ---- Tier 2: Open-Meteo (completely free, NO API KEY) ----
  try {
    const openMeteo = await fetchFromOpenMeteo(district);
    if (openMeteo.length > 0) {
      return { alerts: openMeteo, live: true, source: "OPEN_METEO" };
    }
  } catch {
    // fall through
  }

  return { alerts: fallbackAlerts(district), live: false, source: "DEMO" };
}

// ------------------------------------------------------------
// Open-Meteo forecast -> IMD-threshold rainfall/wind warnings.
// Uses IMD's own intensity bands:
//   >= 64.5 mm/day  heavy        -> SEVERE
//   >= 115.6 mm/day very heavy   -> SEVERE
//   >= 204.4 mm/day extremely    -> EXTREME
//   sustained winds >= 62 km/h   -> SEVERE (cyclonic circulation)
// ------------------------------------------------------------
import { CITY } from "@/config/city";

const CITY_COORDS = { lat: CITY.latitude, lng: CITY.longitude };
async function fetchFromOpenMeteo(district = CITY.name): Promise<NormalizedAlert[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${CITY_COORDS.lat}&longitude=${CITY_COORDS.lng}` +
      `&daily=precipitation_sum,wind_speed_10m_max` +
      `&forecast_days=2&timezone=Asia%2FKolkata`,
    { signal: controller.signal }
  );
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

  const json = await res.json();
  const daily = json?.daily;
  if (!daily?.time?.length) return [];

  const alerts: NormalizedAlert[] = [];
  const now = Date.now();

  for (let i = 0; i < Math.min(2, daily.time.length); i++) {
    const precip = Number(daily.precipitation_sum?.[i] ?? 0);
    const windKmh = Number(daily.wind_speed_10m_max?.[i] ?? 0);
    const day = String(daily.time[i]);

    if (precip >= 64.5) {
      const extreme = precip >= 204.4;
      alerts.push({
        alert_id: `OM-RAIN-${day}-${CITY_COORDS.lat}`,
        source: "IMD",
        severity: extreme ? "EXTREME" : "SEVERE",
        type: "RAINFALL",
        title: `${extreme ? "Extremely heavy" : "Heavy"} rainfall expected - ${district} (${day})`,
        description:
          `Forecast models indicate ~${Math.round(precip)} mm of rain on ${day}. ` +
          (extreme
            ? "Extremely heavy rainfall; flooding likely in low-lying areas. "
            : "Waterlogging possible; avoid waterlogged routes. ") +
          "(Derived from Open-Meteo ensemble data using IMD rainfall intensity thresholds)",
        affected_area: { lat: CITY_COORDS.lat, lng: CITY_COORDS.lng, radius_km: 15 },
        effective_from: new Date(now).toISOString(),
        effective_until: new Date(`${day}T23:59:59+05:30`).toISOString(),
      });
    }

    if (windKmh >= 62) {
      alerts.push({
        alert_id: `OM-WIND-${day}-${CITY_COORDS.lat}`,
        source: "IMD",
        severity: windKmh >= 90 ? "EXTREME" : "SEVERE",
        type: "THUNDERSTORM",
        title: `Strong winds up to ${Math.round(windKmh)} km/h - ${district} (${day})`,
        description:
          `Sustained winds may reach ${Math.round(windKmh)} km/h on ${day}. ` +
          "Secure loose structures; avoid coastal activities. " +
          "(Source: Open-Meteo forecast)",
        affected_area: { lat: CITY_COORDS.lat, lng: CITY_COORDS.lng, radius_km: 20 },
        effective_from: new Date(now).toISOString(),
        effective_until: new Date(`${day}T23:59:59+05:30`).toISOString(),
      });
    }
  }

  return alerts;
}

// Demo-safe synthetic warning, labelled as simulated data
export function fallbackAlerts(district = CITY.name): NormalizedAlert[] {
  const now = Date.now();
  return [
    {
      alert_id: "IMD-DEMO-RAINFALL",
      source: "IMD",
      severity: "SEVERE",
      type: "RAINFALL",
      title: `Heavy to very heavy rainfall warning - ${district} district`,
      description:
        "Isolated heavy to very heavy rainfall very likely over the district during the next 24 hours. Waterlogging possible in low-lying areas. (Simulated data - IMD API not connected)",
      affected_area: { lat: 13.0827, lng: 80.2707, radius_km: 15 },
      effective_from: new Date(now).toISOString(),
      effective_until: new Date(now + 24 * 3600 * 1000).toISOString(),
    },
  ];
}


