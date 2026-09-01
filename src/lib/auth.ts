import { createClient, getUserRole } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Like requireAuth but tolerates anonymous visitors and stale
// sessions - used by public endpoints (e.g. guest incident reports).
export async function optionalAuth(): Promise<{ userId: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { userId: user?.id ?? null };
  } catch {
    return { userId: null };
  }
}

export async function requireAuthority(): Promise<
  { userId: string; role: string } | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole();
  if (!role || !["OPERATOR", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { userId: user.id, role };
}

export async function requireAuth(): Promise<
  { userId: string } | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId: user.id };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
