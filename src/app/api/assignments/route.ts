import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireAuth, requireAuthority } from "@/lib/auth";
import type { AssignmentStatus } from "@/types/database";

// GET /api/assignments?status=EN_ROUTE
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("assignments")
    .select(
      "*, incident:incidents(*), resource:resource_teams(*)"
    )
    .order("assigned_at", { ascending: false });

  if (status) query = query.eq("status", status as AssignmentStatus);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ assignments: data });
}

// POST /api/assignments { incidentId, resourceId, score?, breakdown?, explanation?,
//                          distanceKm?, etaMinutes?, manual? }
// Confirms an allocation recommendation (or a manual pick).
export async function POST(request: NextRequest) {
  const auth = await requireAuthority();
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const incidentId = String(body.incidentId ?? "");
  const resourceId = String(body.resourceId ?? "");
  if (!incidentId || !resourceId)
    return jsonError("incidentId and resourceId are required");  const supabase = await createClient();

  // Guard: refuse to double-assign a busy team
  const { data: team } = await supabase
    .from("resource_teams")
    .select("id, status, current_assignment_id")
    .eq("id", resourceId)
    .single();

  if (!team) return jsonError("Resource not found", 404);
  if (team.current_assignment_id)
    return jsonError("Resource already has an active assignment", 409);

  const isManual = Boolean(body.manual);
  const score =
    typeof body.score === "number" && !isManual ? body.score : null;

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      incident_id: incidentId,
      resource_id: resourceId,
      assigned_by_id: auth.userId,
      status: "PENDING",
      allocation_score: score,
      score_breakdown: (body.breakdown as Record<string, number>) ?? null,
      explanation:
        typeof body.explanation === "string"
          ? isManual
            ? `Manual assignment by operator. ${body.explanation}`
            : body.explanation
          : isManual
            ? "Manual assignment by operator."
            : null,
      distance_km: typeof body.distanceKm === "number" ? body.distanceKm : null,
      eta_minutes: typeof body.etaMinutes === "number" ? Math.round(body.etaMinutes) : null,
      is_manual_override: isManual,
    })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  // DB triggers sync: team -> ASSIGNED, incident -> ASSIGNED
  await supabase.from("assignment_logs").insert({
    assignment_id: data.id,
    event_type: "CREATED",
    description: isManual
      ? "Manually assigned by operator"
      : `Auto-recommended (score ${score ?? "n/a"})`,
  });

  return NextResponse.json({ assignment: data }, { status: 201 });
}
