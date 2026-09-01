import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

async function attempt(label, payload) {
  const { error } = await anon.from("incidents").insert(payload);
  console.log(`${label}: ${error ? "FAIL -> " + error.message : "OK"}`);
}

await attempt("A minimal", {
  description: "probe A",
  latitude: 22.2,
  longitude: 84.8,
  people_affected: 1,
  source: "APP",
});

await attempt("B explicit null reporter_id", {
  reporter_id: null,
  description: "probe B",
  latitude: 22.2,
  longitude: 84.8,
  people_affected: 1,
  source: "APP",
});

await attempt("C full route payload", {
  reporter_id: null,
  description: "probe C full",
  latitude: 22.216,
  longitude: 84.831,
  location_text: null,
  people_affected: 1,
  required_capabilities: ["BOAT"],
  confidence_score: 0.5,
  verification_status: "UNVERIFIED",
  severity: "HIGH",
  type: "FLOOD",
  source: "APP",
  photo_url: null,
  cluster_id: null,
  ai_classification: { by: "RULES" },
});
