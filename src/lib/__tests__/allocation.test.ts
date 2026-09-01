import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  calculateAllocationScore,
  etaMinutes,
  haversineKm,
  rankResources,
  type AllocationWeights,
} from "../allocation.ts";

const weights: AllocationWeights = {
  severity_weight: 0.4,
  eta_weight: 0.2,
  capability_weight: 0.2,
  availability_weight: 0.1,
  capacity_weight: 0.1,
};

const incident = {
  id: "inc-1",
  severity: "CRITICAL" as const,
  required_capabilities: ["BOAT", "MEDICAL"],
  people_affected: 5,
  latitude: 13.09,
  longitude: 80.28,
};

function team(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    team_code: "RT-001",
    status: "AVAILABLE" as const,
    latitude: 13.0878,
    longitude: 80.2107,
    capacity: 6,
    capabilities: ["BOAT", "MEDICAL"],
    ...overrides,
  };
}

test("haversine: known Chennai distance ~7.7km for test coords", () => {
  const d = haversineKm(13.09, 80.28, 13.0878, 80.2107);
  assert.ok(d > 6 && d < 9, `distance was ${d}`);
});

test("haversine: zero distance for identical points", () => {
  assert.equal(haversineKm(13, 80, 13, 80), 0);
});

test("eta: 30km/h average speed", () => {
  assert.equal(Math.round(etaMinutes(30)), 60);
});

test("perfect match scores near max", () => {
  // Same location, full capability, available, enough capacity
  const score = calculateAllocationScore(
    incident,
    team({ latitude: 13.09, longitude: 80.28 }),
    weights
  );
  // severity=100*0.4 + eta=100*0.2 + cap=100*0.2 + avail=100*0.1 + cap2=100*0.1
  assert.equal(score.totalScore, 100);
});

test("missing capability reduces capability score proportionally", () => {
  const score = calculateAllocationScore(
    incident,
    team({ capabilities: ["BOAT"] }), // 1 of 2 matched
    weights
  );
  assert.equal(score.capabilityScore, 50);
  // explanation must mention the missing one
  assert.ok(score.explanation.includes("MEDICAL"));
});

test("no required capabilities => capability is 100", () => {
  const score = calculateAllocationScore(
    { ...incident, required_capabilities: [] },
    team(),
    weights
  );
  assert.equal(score.capabilityScore, 100);
});

test("unavailable resource gets zero availability points and is flagged", () => {
  const score = calculateAllocationScore(
    incident,
    team({ status: "UNAVAILABLE" }),
    weights
  );
  assert.equal(score.availabilityScore, 0);
  assert.ok(score.explanation.includes("unavailable"));
});

test("returning resource scores 50 availability", () => {
  const score = calculateAllocationScore(
    incident,
    team({ status: "RETURNING" }),
    weights
  );
  assert.equal(score.availabilityScore, 50);
});

test("insufficient team capacity caps below 100", () => {
  const score = calculateAllocationScore(
    { ...incident, people_affected: 20 },
    team({ capacity: 10 }), // 10/20 = 50%
    weights
  );
  assert.equal(score.capacityScore, 50);
});

test("capacity above need saturates at 100", () => {
  const score = calculateAllocationScore(
    { ...incident, people_affected: 2 },
    team({ capacity: 10 }),
    weights
  );
  assert.equal(score.capacityScore, 100);
});

test("farther team always loses on ETA component", () => {
  const close = calculateAllocationScore(incident, team(), weights);
  const far = calculateAllocationScore(
    incident,
    team({ latitude: 13.05, longitude: 80.95 }),
    weights
  );
  assert.ok(far.etaScore < close.etaScore);
  assert.ok(far.totalScore < close.totalScore);
});

test("critical outranks low when everything else is equal", () => {
  const crit = calculateAllocationScore(incident, team(), weights);
  const low = calculateAllocationScore(
    { ...incident, severity: "LOW" as const },
    team(),
    weights
  );
  assert.ok(crit.severityScore > low.severityScore);
});

test("rankResources sorts descending by total score", () => {
  const ranked = rankResources(
    incident,
    [
      team({ id: "far-no-cap", capabilities: [], latitude: 13.05, longitude: 80.95 }),
      team({ id: "best" }),
      team({ id: "unavailable", status: "UNAVAILABLE" }),
    ],
    weights
  );
  assert.equal(ranked[0].resourceId, "best");
  assert.ok(ranked[0].totalScore >= ranked[1].totalScore);
  assert.ok(ranked[1].totalScore >= ranked[2].totalScore);
});
