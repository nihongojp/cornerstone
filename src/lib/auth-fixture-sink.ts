import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/*
 * A sign-in code for a test fixture, written to disk instead of mailed.
 *
 * `scripts/parity-check.mjs` needs a signed-in session to check half the route
 * table. It used to sign up a throwaway account with a password; passwordless
 * sign-in closed that endpoint (#55), and nothing that opens a mailbox belongs
 * in a check that has to run unattended.
 *
 * ── Why this is not a hole ───────────────────────────────────────────────────
 *
 * The whole gate is the address suffix, and it is a stronger boundary than it
 * looks: `.invalid` is reserved by RFC 2606 and is guaranteed never to resolve,
 * so no real person can ever hold an address in this domain. A code written
 * here therefore cannot be a real user's code — not "unlikely to be", cannot be.
 *
 * The alternative gates are all weaker. An env flag can be set in the wrong
 * place. `NODE_ENV !== "production"` would silently stop working against a
 * preview deploy and against `npm run start`, which is exactly when someone
 * would be debugging an SSR difference. The domain check has neither failure
 * mode and needs no configuration.
 *
 * It also intercepts *before* better-auth stores anything, which is the point:
 * `storeOTP` and `storeToken` are `"hashed"`, so the code is not recoverable
 * from the database. That is deliberate — the `verification` table is copied
 * wholesale into every Neon branch, and a plaintext code there would turn a
 * preview branch URL into a working sign-in for whoever requested one last.
 */

/** Reserved by RFC 2606. Nothing here can ever be a deliverable address. */
const FIXTURE_DOMAIN = "@parity-check.invalid";

/** Somewhere both the server and a script on the same host can reach. */
const SINK_DIR = path.join(os.tmpdir(), "cornerstone-parity");

export function isFixtureAddress(email: string): boolean {
  return email.toLowerCase().endsWith(FIXTURE_DOMAIN);
}

/** Where the code for this address lands. Also used by the parity script. */
export function fixtureSinkPath(email: string): string {
  const safe = email.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return path.join(SINK_DIR, `${safe}.txt`);
}

/**
 * Writes the code and reports whether it handled the address. `false` means
 * "not a fixture, mail it normally".
 */
export function captureFixtureCode(email: string, code: string): boolean {
  if (!isFixtureAddress(email)) return false;
  mkdirSync(SINK_DIR, { recursive: true });
  writeFileSync(fixtureSinkPath(email), code, "utf8");
  return true;
}
