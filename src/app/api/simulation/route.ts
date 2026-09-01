import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { jsonError, requireAuthority } from "@/lib/auth";
import {
  getSimulationStatus,
  startSimulation,
  stopSimulation,
  resetDemoData,
} from "@/lib/simulation";

// Build a request-scoped-independent Supabase client for the simulation
// engine's timers. The cookie-bound server client dies with the HTTP
// request, but timers fire seconds/minutes later - so we capture the
// operator's JWT now and attach it to a standalone client.
async function createTimerSafeClient() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  const userId = data.session?.user?.id;

  return {
    db: createRawClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: jwt
          ? { headers: { Authorization: `Bearer ${jwt}` } }
          : undefined,
      }
    ),
    userId,
  };
}

// POST /api/simulation  { action: "start" | "stop" | "reset", scenarioId? }
export async function POST(request: NextRequest) {
  const auth = await requireAuthority();
  if (auth instanceof NextResponse) return auth;

  let body: { action?: string; scenarioId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (body.action === "start") {
    const { db, userId } = await createTimerSafeClient();
    const result = startSimulation(body.scenarioId ?? "flood-rourkela", db, userId);
    if (!result.ok) return jsonError(result.error ?? "Could not start", 400);
    return NextResponse.json({ ...getSimulationStatus(), ...result });
  }

  if (body.action === "stop") {
    const stopped = stopSimulation();
    return NextResponse.json({ stopped, ...getSimulationStatus() });
  }

  if (body.action === "reset") {
    stopSimulation();
    const supabase = await createServerClient();
    try {
      await resetDemoData(supabase);
    } catch (err) {
      console.error("[simulation] reset failed:", err);
      return jsonError(
        err instanceof Error ? err.message : "Reset failed",
        500
      );
    }
    return NextResponse.json({ reset: true });
  }

  return jsonError("action must be start | stop | reset");
}

// GET /api/simulation - current engine status
export async function GET() {
  const auth = await requireAuthority();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(getSimulationStatus());
}
