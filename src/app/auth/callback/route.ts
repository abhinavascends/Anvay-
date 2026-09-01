import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { UserRole } from "@/types/database";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const cookieChanges: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[] = [];

  let role: UserRole | null = null;

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((c) => cookieChanges.push(c));
          },
        },
      }
    );

    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      role = (profile?.role as UserRole) ?? null;
    }
  }

  function roleToPath(r: UserRole | null): string {
    switch (r) {
      case "OPERATOR":
      case "ADMIN":
        return "/dashboard";
      case "FIELD_TEAM":
        return "/team";
      case "SHELTER_MANAGER":
        return "/shelter-manage";
      case "CITIZEN":
      default:
        return "/citizen";
    }
  }

  const destination = roleToPath(role);
  const response = NextResponse.redirect(`${origin}${destination}`);
  cookieChanges.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
