import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/*
 * Optimistic gate only: this checks that a session cookie is *present*, not that
 * it is valid — validating would mean a database call, which the edge runtime
 * can't do cheaply. It exists to bounce logged-out visitors before a protected
 * page renders. Actual enforcement lives in the (protected)/(dashboard)/(player)
 * layouts and in every route handler, which call auth.api.getSession().
 */
export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const url = new URL("/auth", request.url);
  // Preserves the CRA behaviour of returning the user to the page they wanted
  // (react-router carried this in location.state.from).
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard",
    "/lesson/:path*",
    "/newlesson/:path*",
    "/new-lessons",
    "/watch",
    "/talk",
    "/profile",
  ],
};
