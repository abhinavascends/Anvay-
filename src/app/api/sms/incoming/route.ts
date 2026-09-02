import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/auth";
import { parseSms } from "@/lib/sms";
import { DEFAULT_REPORT_LOCATION } from "@/config/city";

export async function POST(request: NextRequest) {
  const secret = process.env.SMS_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-sms-secret") !== secret) {
    return jsonError("Invalid webhook secret", 401);
  }

  const contentType = request.headers.get("content-type") ?? "";
  let from: string | undefined;
  let text: string;
  let latitude: number | undefined;
  let longitude: number | undefined;
  let location_text: string | undefined;

  if (contentType.includes("application/json")) {
    const body = await request.json();
    from = body.from;
    text = typeof body.text === "string" ? body.text : "";
    latitude = body.latitude;
    longitude = body.longitude;
    location_text = body.location_text;
  } else {
    const formData = await request.formData();
    from = formData.get("From")?.toString();
    text = formData.get("Body")?.toString() ?? "";
    const lat = formData.get("Latitude");
    latitude = lat ? Number(lat) : undefined;
    const lon = formData.get("Longitude");
    longitude = lon ? Number(lon) : undefined;
    location_text = formData.get("location_text")?.toString() ?? undefined;
  }

  if (!text) return jsonError("text is required");

  const parsed = parseSms(text);
  if (!parsed.ok) return jsonError(parsed.error ?? "Could not parse message", 422);

  const supabase = await createClient();

  let reporterId: string | null = null;
  if (from) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", from)
      .maybeSingle();
    reporterId = profile?.id ?? null;
  }

  const { data: incident, error } = await supabase
    .from("incidents")
    .insert({
      reporter_id: reporterId,
      description: parsed.description,
      latitude: latitude ?? DEFAULT_REPORT_LOCATION.latitude,
      longitude: longitude ?? DEFAULT_REPORT_LOCATION.longitude,
      location_text: location_text ?? null,
      people_affected: parsed.peopleAffected,
      severity: parsed.severity,
      type: parsed.type,
      source: "SMS",
      confidence_score: 0.45,
    })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json(
    {
      received: true,
      incident_number: incident.incident_number,
      parsed: {
        type: parsed.type,
        severity: parsed.severity,
        people_affected: parsed.peopleAffected,
      },
      reply: `RakshaSetu: Report ${incident.incident_number} received. Help is being coordinated. Keep this number for reference.`,
    },
    { status: 201 }
  );
}

