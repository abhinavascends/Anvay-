import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireAuth } from "@/lib/auth";
import { classifyReport } from "@/lib/classifier";

// POST /api/classify { text }
// Preview endpoint - shows what the AI pipeline extracts from a report
// without creating an incident. Useful for demos and testing.
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!body.text || body.text.trim().length < 5)
    return jsonError("text must be at least 5 characters");

  const classification = await classifyReport(body.text);
  return NextResponse.json({ classification });
}
