import "server-only";
import { draftMode, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { payloadClient } from "./content/payload";

/** Current session, or null. Server-side only. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * The real auth boundary for protected pages — the proxy (src/proxy.ts) only
 * checks that a cookie exists. Replaces the Express requireAuth middleware for
 * page loads.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/auth");
  return session;
}

/**
 * The CMS editor behind a Draft Mode request, or null.
 *
 * Draft Mode's cookie is a build-scoped bearer token. Next checks its value
 * against a random per-build id, so it cannot be forged in production — but it
 * names nobody, it keeps working after the editor who obtained it signs out of
 * /admin or is removed from `cms_admins`, and in development Next accepts any
 * value for it at all. So the cookie only says "this request wants drafts";
 * *who* is asking is re-checked here, against Payload, on every request.
 *
 * Returning the user rather than a boolean because the draft reads in
 * `lib/content/content.ts` pass it to `payload.find` as `user`, which keeps
 * those reads on the same access rules as every other read in the app.
 */
export async function getPreviewEditor() {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return null;

  const payload = await payloadClient();
  try {
    const { user } = await payload.auth({ headers: await headers() });
    return user ?? null;
  } catch (err) {
    // Same reasoning as the Media read gate: a failure here is "not an
    // editor", not a 500 on the page.
    payload.logger.error({ err, msg: "Preview editor check failed" });
    return null;
  }
}

/**
 * The gate on the lesson players.
 *
 * A learner needs a better-auth session. A CMS editor previewing a draft does
 * not have one and never will — the two identity systems are unrelated, the
 * same split the Media collection's read access already straddles. Either
 * identity gets in; neither gets in on the strength of a cookie alone.
 */
export async function requirePlayerAccess() {
  if (await getPreviewEditor()) return null;
  return requireSession();
}
