/*
 * The origin Live Preview checks incoming messages against.
 *
 * `useLivePreview` compares `serverURL` to the origin of every `postMessage`
 * from the admin and ignores anything that does not match, so getting it wrong
 * means the panel renders once and then silently never updates.
 *
 * It came from `NEXT_PUBLIC_SERVER_URL` alone, defaulted to `""`. That default
 * is worse than useless: an empty string is not a valid target origin, so the
 * hook throws `Failed to execute 'postMessage' on 'Window': Invalid target
 * origin ""` and the preview pane fills with a Next error overlay the moment the
 * editor types. `.env.example` has carried the variable since Phase 0a, but a
 * `.env.local` predating that does not, and nothing said so.
 *
 * `window.location.origin` is the right fallback rather than a guess: /admin and
 * the site are the same Next application on the same origin, which is the whole
 * reason the message arrives at all. The environment variable still wins, for
 * the deployment where the admin is served from somewhere else.
 *
 * Not `server-only`: the preview wrappers are client components. On the server
 * there is no `window`, and the value is unused there — the hook only runs after
 * mount.
 */
export function previewOrigin(configured?: string): string {
  const fromEnv = configured?.trim();
  if (fromEnv) return fromEnv;
  return typeof window === "undefined" ? "" : window.location.origin;
}
