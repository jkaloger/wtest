import { NextResponse, type NextRequest } from "next/server";
import { redirectFor } from "./src/lib/auth/guard";
import { authCookieName } from "./src/lib/supabase/client";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(authCookieName());
  const target = redirectFor(request.nextUrl.pathname, hasSession);
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
