import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSms } from "../sms.ts";

test("basic flood report with people count", () => {
  const r = parseSms("SOS FLOOD near ward 12 bridge 5 people");
  assert.equal(r.ok, true);
  assert.equal(r.type, "FLOOD");
  assert.equal(r.peopleAffected, 5);
});

test("trapped keyword escalates to CRITICAL", () => {
  const r = parseSms("SOS water entering house 3 trapped elderly");
  assert.equal(r.ok, true);
  assert.equal(r.severity, "CRITICAL");
  assert.equal(r.peopleAffected, 3);
});

test("fire type detection", () => {
  const r = parseSms("SOS FIRE building on fire 12 people");
  assert.equal(r.type, "FIRE");
  assert.equal(r.peopleAffected, 12);
  // >=10 without urgency keywords -> HIGH
  assert.equal(r.severity, "HIGH");
});

test("medical emergency detected", () => {
  const r = parseSms("SOS pregnant woman needs help near market");
  assert.equal(r.type, "MEDICAL_EMERGENCY");
  assert.equal(r.severity, "CRITICAL");
});

test("non-SOS message rejected", () => {
  const r = parseSms("hello what is the weather today");
  assert.equal(r.ok, false);
});

test("no count defaults to 1 person", () => {
  const r = parseSms("SOS flood on my street");
  assert.equal(r.ok, true);
  assert.equal(r.peopleAffected, 1);
});

test("count capped at sane values", () => {
  const r = parseSms("SOS FLOOD 99999 people stranded");
  assert.equal(r.peopleAffected, 9999);
});

test("case insensitive SOS prefix", () => {
  const r = parseSms("sos flood rising fast 7 people");
  assert.equal(r.ok, true);
  assert.equal(r.type, "FLOOD");
});
