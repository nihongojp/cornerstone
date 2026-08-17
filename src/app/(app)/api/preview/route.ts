import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

import { payloadClient } from "../../../../lib/content/payload";
import { isPreviewablePath } from "../../../../lib/content/routes";

/*
 * The only thing in the app that turns Draft Mode on.
 *
 * Two independent checks, and both have to pass:
 *
 *  - `previewSecret` proves the link came out of our own admin. Payload puts it
 *    in the Live Preview iframe's `src`, so any signed-in editor can read it
 *    back out of the DOM — it filters stray requests, it is not the boundary.
 *  - `payload.auth()` is the boundary. It validates the `payload-token` cookie
 *    against `cms_admins`. The admin is mounted on this same origin, so that
 *    cookie is first-party and rides along with the iframe's request.
 *
 * This route sits in the (app) group while Payload's REST catch-all sits at
 * (payload)/api/[...slug]. They do not collide: Next only rejects two files
 * resolving to the *same* path, and a literal segment wins over a catch-all.
 * /api/progress and /api/pronunciation/check already live here the same way.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const previewSecret = searchParams.get("previewSecret");

  // Fail closed: an unset secret has to refuse everything, not wave everything
  // through on `undefined === undefined`.
  const expected = process.env.PREVIEW_SECRET;
  if (!expected || previewSecret !== expected) {
    return new Response("You are not allowed to preview this page", {
      status: 403,
    });
  }

  // Allowlisted, not merely "starts with a slash" — "//evil.com" passes that
  // test and is a protocol-relative URL. See `isPreviewablePath`.
  if (!path || !isPreviewablePath(path)) {
    return new Response("Not a previewable path", { status: 400 });
  }

  const payload = await payloadClient();
  const draft = await draftMode();

  let user;
  try {
    // Destructured, not assigned whole: `payload.auth()` resolves to
    // `{ user, permissions }`, an object that is truthy whether or not anyone
    // is signed in. Testing the result itself would let everyone through.
    ({ user } = await payload.auth({ headers: request.headers }));
  } catch (err) {
    payload.logger.error({ err, msg: "Preview auth check failed" });
    return new Response("You are not allowed to preview this page", {
      status: 403,
    });
  }

  if (!user) {
    // Clears a cookie an earlier session left behind, so someone who has since
    // signed out of /admin stops seeing drafts on the public site.
    draft.disable();
    return new Response("You are not allowed to preview this page", {
      status: 403,
    });
  }

  draft.enable();
  redirect(path);
}
