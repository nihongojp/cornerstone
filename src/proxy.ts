import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/*
 * Next 16 renamed the Middleware convention to Proxy — same file position, same
 * runtime, same `config.matcher`; the exported function is now `proxy`. Nothing
 * about the behaviour below changed with the rename.
 *
 * Optimistic gate only: this checks that a session cookie is *present*, not that
 * it is valid — validating would mean a database call, which the edge runtime
 * can't do cheaply. It exists to bounce logged-out visitors before a protected
 * page renders. Actual enforcement lives in the (learn)/(dashboard)/(player)
 * layouts and in every route handler, which call auth.api.getSession().
 *
 * That split is the shape Next's own guidance asks for: it names optimistic
 * checks as a valid use of Proxy and says outright that it should not be a
 * project's session-management or authorization solution.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  /*
   * A Draft Mode request from the CMS preview panel. Presence only, the same
   * optimistic rule the session cookie above gets: the Proxy runs on the edge,
   * where it can reach neither Payload nor the build's preview id, so it cannot
   * do better than this. The (player) layout re-checks the editor against
   * `cms_admins`, which is where a bad cookie is caught.
   */
  if (request.cookies.has("__prerender_bypass")) return NextResponse.next();

  const url = new URL("/auth", request.url);
  /*
   * Where the visitor was actually going, so sign-in can put them back there.
   *
   * Path *and* query: the query is often the half that matters — a filtered
   * list or a deep link is a different destination from its bare path, and
   * dropping it silently returns someone to a page that has forgotten what
   * they asked for. `lib/return-path.ts` accepts a query string for this
   * reason, and is what narrows the value again on the way back out.
   */
  url.searchParams.set("from", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard",
    "/lessons/:path*",
    "/watch",
    "/talk",
    "/profile",
  ],
};
