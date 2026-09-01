import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/auth";
import type { AssignmentStatus } from "@/types/database";

const FLOW: Record<AssignmentStatus, AssignmentStatus | null> = {
  PENDING: "ACKNOWLEDGED",
  ACKNOWLEDGED: "EN_ROUTE",
  EN_ROUTE: "ON_SCENE",
  ON_SCENE: "COMPLETED",
  COMPLETED: null,
  INTERRUPTED: null,
  CANCELLED: null,
};

const STATUSES = Object.keys(FLOW) as AssignmentStatus[];

// PATCH /api/assignments/[id] { status }
// Field team / operator progress updates. DB triggers keep the
// team status and incident status in sync.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const status = body.status as AssignmentStatus;
  if (!STATUSES.includes(status)) return jsonError("status is invalid");

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, status")
    .eq("id", id)
    .single();
  if (!assignment) return jsonError("Assignment not found", 404);

  // Enforce forward-only progression (except terminal states)
  if (
    assignment.status !== status &&
    FLOW[assignment.status] &&
    FLOW[assignment.status] !== status
  ) {
    return jsonError(
      `Cannot move from ${assignment.status} to ${status}; expected ${FLOW[assignment.status]}`,
      409
    );
  }

  const patch: {
    status: AssignmentStatus;
    acknowledged_at?: string;
    arrived_at?: string;
    completed_at?: string;
  } = { status };
  if (status === "ACKNOWLEDGED") patch.acknowledged_at = new Date().toISOString();
  if (status === "ON_SCENE") patch.arrived_at = new Date().toISOString();
  if (status === "COMPLETED") patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("assignments")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  await supabase.from("assignment_logs").insert({
    assignment_id: id,
    event_type:
      status === "ACKNOWLEDGED"
        ? "ACKNOWLEDGED"
        : status === "COMPLETED"
          ? "COMPLETED"
          : "STATUS_CHANGED",
    description: `Status changed to ${status}`,
    metadata: { by: user.id },
  });

  return NextResponse.json({ assignment: data });
}
