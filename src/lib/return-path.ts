/*
 * Where sign-in sends you afterwards, and why it is validated.
 *
 * `src/proxy.ts` bounces a signed-out visitor to `/auth?from=<path>` so they
 * land back where they were going. That value arrives from the URL bar, so it
 * is attacker-controlled: `/auth?from=https://evil.com` would otherwise send a
 * *just-authenticated* user straight off-site, which is the convincing version
 * of a phishing hop because it happens after a real sign-in on the real domain.
 *
 * Better Auth already refuses a `callbackURL` like that server-side
 * (`originCheckMiddleware` → `isTrustedOrigin`), so the magic-link and Google
 * paths were covered. The one-time-code and password paths finish on this page
 * and hand the value to `router.push`, which never reaches that check — so the
 * value is narrowed here instead, once, at the point it is read. Everything
 * downstream then gets a path that is already safe.
 *
 * The pattern is Better Auth's own rule for a relative path rather than a
 * hand-rolled one, so the client and the server agree on what is acceptable:
 * it must start with a single `/`, and it rejects protocol-relative `//host`,
 * a backslash, and percent-encoded separators. `%` is absent from the path
 * character class, so anything encoded fails closed to the fallback rather
 * than being decoded and re-examined.
 */
const RELATIVE_PATH = /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/i;

/** Where a signed-in learner belongs when nothing better is known. */
export const DEFAULT_RETURN_PATH = "/lessons";

/**
 * The path to return to after signing in, or `fallback` when the value is
 * missing or is anything other than a same-origin relative path.
 */
export function safeReturnPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_RETURN_PATH
): string {
  if (typeof value !== "string" || value === "") return fallback;
  return RELATIVE_PATH.test(value) ? value : fallback;
}
