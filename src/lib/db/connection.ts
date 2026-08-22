/*
 * Leaf module: imported by `payload.config.ts`, which the Payload CLI loads
 * in plain Node, so this file must not pull in `server-only` or `src/lib/db`.
 *
 * Neon emits `sslmode=require`. Under `pg` 8 that is an alias for
 * `verify-full` (chain plus hostname). Under `pg` 9 / `pg-connection-string`
 * v3 it becomes libpq's `require`: encrypted, not verified. Pinning the
 * current behaviour in code, not in the connection strings, because those
 * come from Neon and the Vercel integration re-injects them on every deploy.
 *
 * `channel_binding=require` on those same URLs does not cover us. `pg` only
 * offers SCRAM-SHA-256-PLUS when `enableChannelBinding` is set on the client,
 * and nothing here sets it. Turning that on is a separate change.
 */

const WEAKER = new Set(["allow", "prefer", "require"]);

/**
 * Raise `sslmode` to `verify-full` when the URL already asks for TLS but
 * names a weaker mode. A URL with no `sslmode` is left alone so a local
 * `postgresql://localhost` string still works without TLS.
 */
export function pinSslMode(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }

  const mode = url.searchParams.get("sslmode");
  if (mode === null) return connectionString;
  if (!WEAKER.has(mode.toLowerCase())) return connectionString;

  // Rewrite only this query value so a password's encoding is not
  // round-tripped through `URL.toString()`.
  return connectionString.replace(/([?&])sslmode=[^&]*/i, "$1sslmode=verify-full");
}
