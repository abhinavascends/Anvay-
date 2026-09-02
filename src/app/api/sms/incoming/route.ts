import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/auth";
import { parseSms } from "@/lib/sms";


// POST /api/sms/incoming
//
// Connectivity-fallback channel: an SMS gateway (Twilio, Gupshup, or the
// demo simulator) posts inbound citizen SMS here. No user session exists
// on this path, so we authenticate with a shared webhook secret.
//
// Body: { from: string, text: string }
export async function POST(request: NextRequest) {
  const secret = process.env.SMS_WEBHOOK_SECRET;

if (!secret) {
  return jsonError("SMS webhook is not configured", 503);
}

if (request.headers.get("x-sms-secret") !== secret) {
  return jsonError("Invalid webhook secret", 401);
}

  let body: {
    from?: string;
    text?: string;
    latitude?: number;
    longitude?: number;
    location_text?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text) return jsonError("text is required");

  const parsed = parseSms(text);
if (!parsed.ok) return jsonError(parsed.error ?? "Could not parse message", 422);

const hasLatitude =
  typeof body.latitude === "number" &&
  Number.isFinite(body.latitude) &&
  body.latitude >= -90 &&
  body.latitude <= 90;

const hasLongitude =
  typeof body.longitude === "number" &&
  Number.isFinite(body.longitude) &&
  body.longitude >= -180 &&
  body.longitude <= 180;

const hasGpsLocation = hasLatitude && hasLongitude;

const supabase = await createClient();

  // Resolve reporter by phone number when known
  let reporterId: string | null = null;
  if (body.from) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", body.from)
      .maybeSingle();
    reporterId = profile?.id ?? null;
  }

  const { data: incident, error } = await supabase
    .from("incidents")
    .insert({
      reporter_id: reporterId,
      description: parsed.description,
      latitude: hasGpsLocation ? body.latitude! : null,
longitude: hasGpsLocation ? body.longitude! : null,
location_status: hasGpsLocation
  ? "GPS_CONFIRMED"
  : body.location_text
    ? "LANDMARK_ONLY"
    : "PENDING",

location_source: hasGpsLocation
  ? "SMS_GATEWAY_GPS"
  : body.location_text
    ? "CITIZEN_TEXT"
    : null,

location_accuracy_m: null,

location_updated_at:
  hasGpsLocation || body.location_text
    ? new Date().toISOString()
    : null,
      location_text: body.location_text ?? null,
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