import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireAuthority } from "@/lib/auth";
import { fetchIMDAlerts } from "@/lib/imd";

// POST /api/alerts/sync  - pull IMD warnings into the alerts table.
// Called by the dashboard every 15 minutes (and manually for demos).
export async function POST() {
  const auth = await requireAuthority();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { alerts, live, source } = await fetchIMDAlerts();

  let synced = 0;
  for (const alert of alerts) {
    const { error } = await supabase.from("alerts").upsert(alert, {
      onConflict: "alert_id",
    });
    if (!error) synced++;
  }

  // Expire stale active alerts
  await supabase
    .from("alerts")
    .update({ is_active: false })
    .eq("is_active", true)
    .lt("effective_until", new Date().toISOString());

  return NextResponse.json({ synced, live, source });
}

// GET /api/alerts - active weather warnings
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("is_active", true)
    .order("effective_from", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ alerts: data ?? [] });
}
