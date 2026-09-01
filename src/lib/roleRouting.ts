"use client";

import { createClient } from "@/lib/supabase/client";

// Route each role to its dedicated home after sign-in.
export async function routeByRole(fallback = "/login") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/login";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  switch (profile?.role) {
    case "OPERATOR":
    case "ADMIN":
      return "/dashboard";
    case "FIELD_TEAM":
      return "/team";
    case "SHELTER_MANAGER":
      return "/shelter-manage";
    case "CITIZEN":
    default:
      // Unknown / missing role defaults to citizen dashboard
      return "/citizen";
  }
}
