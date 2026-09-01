import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Real Next.js middleware (must be src/middleware.ts for Next.js to pick it up)
// This is an optimistic auth gate; the actual authorization checks still happen
// in the route layouts and Supabase RLS.
// ---------------------------------------------------------------------------

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/team",
  "/shelter-manage",
  "/citizen",
] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // 1. Unauthenticated user tries a protected route ? redirect to /login
  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Authenticated user hits /register ? send to /login so routeByRole fires
  if (hasSession && pathname === "/register") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 3. Let everything else through; server-side layouts do the role check.
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
