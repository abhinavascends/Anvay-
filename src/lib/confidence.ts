import type { IncidentSeverity, ReportSource } from "@/types/database";

// ============================================================
// Confidence scoring — "how much should we trust this report?"
//
//   Official alert        ~0.95
//   Verified/corroborated  boosted by nearby report count
//   Photo attached         +0.05
//   Single unverified app  ~0.50
//   SMS/IVR                lower base
// ============================================================

const SOURCE_BASE: Record<ReportSource, number> = {
  OFFICIAL: 0.95,
  MANUAL: 0.7,
  APP: 0.5,
  SMS: 0.45,
  IVR: 0.4,
};

export function baseConfidence(source: ReportSource): number {
  return SOURCE_BASE[source] ?? 0.5;
}

export function corroborationBoost(nearbyCount: number): number {
  if (nearbyCount >= 10) return 0.4;
  if (nearbyCount >= 5) return 0.3;
  if (nearbyCount >= 2) return 0.15;
  return 0;
}

export function calculateConfidence(input: {
  source: ReportSource;
  hasPhoto: boolean;
  nearbyReports: number;
}): number {
  let score = baseConfidence(input.source);
  score += corroborationBoost(input.nearbyReports);
  if (input.hasPhoto) score += 0.05;
  return Math.min(1, Math.round(score * 100) / 100);
}

export function verificationFor(
  confidence: number
): "UNVERIFIED" | "CORROBORATED" | "CONFIRMED" | "REJECTED" {
  if (confidence >= 0.8) return "CONFIRMED";
  if (confidence >= 0.6) return "CORROBORATED";
  return "UNVERIFIED";
}

// Severity priority used when merging clustered reports upward
export function highestSeverity(a: IncidentSeverity, b: IncidentSeverity): IncidentSeverity {
  const order: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
