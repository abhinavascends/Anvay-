import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireAuthority } from "@/lib/auth";
import type { AssignmentStatus, IncidentStatus } from "@/types/database";

const STATUSES = [
  "REPORTED",
  "VALIDATED",
  "UNASSIGNED",
  "ASSIGNED",
  "EN_ROUTE",
  "ON_SCENE",
  "RESOLVED",
  "ESCALATED",
  "CANCELLED",
];

// PATCH /api/incidents/[id] - operator status updates
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthority();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!STATUSES.includes(String(body.status))) return jsonError("status is invalid");

  const supabase = await createClient();
  const patch: { status: IncidentStatus; resolved_at?: string } = {
    status: body.status as IncidentStatus,
  };
  if (body.status === "RESOLVED") patch.resolved_at = new Date().toISOString();

  // If operator resolves/cancels, close any open assignments for this incident
  if (["RESOLVED", "CANCELLED"].includes(String(body.status))) {
    const closeStatus = body.status === "RESOLVED" ? "COMPLETED" : "CANCELLED";
    await supabase
      .from("assignments")
      .update({ status: closeStatus as AssignmentStatus })
      .in("status", ["PENDING", "ACKNOWLEDGED", "EN_ROUTE", "ON_SCENE"])
      .eq("incident_id", id);
  }

  const { data, error } = await supabase
    .from("incidents")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ incident: data });
}
