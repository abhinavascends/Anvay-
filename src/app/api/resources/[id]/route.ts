import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireAuth } from "@/lib/auth";
import { rankResources, type AllocationScore } from "@/lib/allocation";
import type { ResourceStatus } from "@/types/database";

const STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "EN_ROUTE",
  "ON_SCENE",
  "RETURNING",
  "UNAVAILABLE",
];

// PATCH /api/resources/[id] { status }
//
// The judge-demo flow: flipping a team to UNAVAILABLE while it holds an
// active assignment interrupts that assignment and the engine immediately
// recommends a replacement for each orphaned incident.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const status = body.status;
  if (!status || !STATUSES.includes(status)) return jsonError("status is invalid");
  const newStatus = status as ResourceStatus;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["OPERATOR", "ADMIN", "FIELD_TEAM"].includes(profile.role)) {
    return jsonError("Forbidden", 403);
  }

  const { data: team } = await supabase
    .from("resource_teams")
    .select("*")
    .eq("id", id)
    .single();
  if (!team) return jsonError("Resource not found", 404);

  // Block status changes that conflict with an active assignment
  const hasActiveAssignment = Boolean(team.current_assignment_id);
  const activeStatuses = ["ASSIGNED", "EN_ROUTE", "ON_SCENE"];
  if (
    hasActiveAssignment &&
    ["AVAILABLE"].includes(status) &&
    activeStatuses.includes(team.status)
  ) {
    return jsonError(
      "Team has an active assignment - complete or interrupt it first",
      409
    );
  }

  const { data: updated, error } = await supabase
    .from("resource_teams")
    .update({ status: newStatus, last_status_update: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  // ---- Reassignment pipeline ------------------------------------
  let reallocations: (AllocationScore & { incidentId: string })[] | null = null;

  if (newStatus === "UNAVAILABLE" && hasActiveAssignment) {
    const activeAssignmentId = team.current_assignment_id as string;

    const { data: interrupted } = await supabase
      .from("assignments")
      .update({ status: "INTERRUPTED" })
      .eq("resource_id", id)
      .in("status", ["PENDING", "ACKNOWLEDGED", "EN_ROUTE", "ON_SCENE"])
      .select("incident_id");

    await supabase.from("assignment_logs").insert({
      assignment_id: activeAssignmentId,
      event_type: "INTERRUPTED",
      description: `Resource ${team.team_code} became UNAVAILABLE`,
    });

    const orphanedIncidentIds = (interrupted ?? []).map((r) => r.incident_id);

    if (orphanedIncidentIds.length > 0) {
      const [incidentsRes, weightsRes] = await Promise.all([
        supabase.from("incidents").select("*").in("id", orphanedIncidentIds),
        supabase.from("allocation_weights").select("*").eq("is_active", true).single(),
      ]);

      const candidatesRes = await supabase
        .from("resource_teams")
        .select("*")
        .in("status", ["AVAILABLE", "RETURNING"]);

      const weights = weightsRes.data;
      const incidents = incidentsRes.data ?? [];
      const candidates = (candidatesRes.data ?? []).filter((c) => c.id !== id);

      reallocations =
        weights && candidates.length > 0
          ? incidents.flatMap((incident) =>
              rankResources(incident, candidates, weights).slice(0, 1)
            )
          : [];
    }
  }

  return NextResponse.json({
    resource: updated,
    reallocations:
      reallocations === null
        ? null
        : reallocations.map((r) => ({
            incident_id: r.incidentId,
            recommended_resource_id: r.resourceId,
            total_score: r.totalScore,
            eta_minutes: r.etaMinutes,
            explanation: r.explanation,
          })),
  });
}

// GET /api/resources/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resource_teams")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return jsonError(error.message, 404);
  return NextResponse.json({ resource: data });
}
