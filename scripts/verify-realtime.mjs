import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const email = `rt-probe-${Date.now()}@example.com`;
const password = "RtProbe!2345";

const admin = createClient(url, key);

console.log("1. Signing up probe user...");
const { data: su, error: suErr } = await admin.auth.signUp({ email, password });
if (suErr || !su.session) {
  console.error("SIGNUP FAILED / NO SESSION:", suErr?.message ?? "email confirmation likely enabled");
  process.exit(1);
}
const jwt = su.session.access_token;
const uid = su.user.id;
console.log("   OK got session for", uid);

// Client that listens, authenticated as the probe user
const listener = createClient(url, key, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

let gotEvent = null;
const timeout = new Promise((res) => setTimeout(() => res("TIMEOUT"), 12000));

console.log("2. Subscribing to postgres_changes on public.incidents ...");
const channel = listener
  .channel("rt-probe")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "incidents" },
    (payload) => {
      gotEvent = payload;
      console.log("   EVENT RECEIVED:", payload.new?.incident_number);
    }
  )
  .subscribe((status) => console.log("   channel status:", status));

// The writer client inserts its own report (RLS: reporter_id = auth.uid())
const writer = createClient(url, key, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

await new Promise((r) => setTimeout(r, 2500));

console.log("3. Inserting an incident as the probe user...");
const t0 = Date.now();
const { error: insErr } = await writer.from("incidents").insert({
  reporter_id: uid,
  description: "realtime verification probe",
  latitude: 22.22,
  longitude: 84.85,
  people_affected: 1,
  source: "APP",
});
if (insErr) {
  console.error("INSERT FAILED:", insErr.message);
  process.exit(1);
}
console.log("   insert OK");

const result = await Promise.race([
  new Promise((res) => {
    const iv = setInterval(() => {
      if (gotEvent) { clearInterval(iv); res("EVENT"); }
    }, 200);
  }),
  timeout,
]);

if (result === "EVENT") {
  console.log(`RESULT: REALTIME WORKS — delivered in ${Date.now() - t0}ms`);
} else {
  console.log("RESULT: REALTIME DELIVERY FAILED — no event within 12s");
}

listener.removeChannel(channel);
process.exit(result === "EVENT" ? 0 : 2);
