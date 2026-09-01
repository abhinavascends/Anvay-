import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireAuthority } from "@/lib/auth";
import { rankResources } from "@/lib/allocation";

// POST /api/assignments/allocate { incidentId }
// Scores all feasible resources for the incident and returns the
// ranked recommendations (top-3 by default) with full breakdowns.
export async function POST(request: NextRequest) {
  const auth = await requireAuthority();
  if (auth instanceof NextResponse) return auth;

  let body: { incidentId?: string; topN?: number };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  if (!body.incidentId) return jsonError("incidentId is required");

  const supabase = await createClient();

  const [{ data: incident, error: incErr }, { data: weights }] = await Promise.all([
    supabase.from("incidents").select("*").eq("id", body.incidentId).single(),
    supabase
      .from("allocation_weights")
      .select("*")
      .eq("is_active", true)
      .single(),
  ]);

  if (incErr || !incident) return jsonError("Incident not found", 404);
  if (!weights) return jsonError("No active allocation weights configured", 500);

  const { data: resources, error: resErr } = await supabase
    .from("resource_teams")
    .select("*")
    .in("status", ["AVAILABLE", "RETURNING"]);

  if (resErr) return jsonError(resErr.message, 500);
  if (!resources?.length)
    return NextResponse.json({ recommendations: [], message: "No available resources" });

  const ranked = rankResources(incident, resources, weights);

  return NextResponse.json({
    incident_id: incident.id,
    weights_used: {
      severity: weights.severity_weight,
      eta: weights.eta_weight,
      capability: weights.capability_weight,
      availability: weights.availability_weight,
      capacity: weights.capacity_weight,
    },
    candidates_evaluated: resources.length,
    recommendations: ranked.slice(0, Math.max(1, Math.min(body.topN ?? 3, 10))),
  });
}
