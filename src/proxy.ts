import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic auth check only - real authorization is enforced by Supabase RLS.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // @supabase/ssr stores the session under sb-<project-ref>-auth-token
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!hasSession && (pathname.startsWith("/dashboard") || pathname.startsWith("/team") || pathname.startsWith("/shelter-manage") || pathname.startsWith("/citizen"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/team/:path*",
    "/shelter-manage/:path*",
    "/citizen/:path*",
    "/login",
    "/register",
  ],
};
