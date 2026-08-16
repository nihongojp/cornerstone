import { randomInt } from "node:crypto";

import { config } from "dotenv";

/*
 * Creates the Payload CMS admin accounts (#34).
 *
 *   npm run payload:seed-admins
 *   npm run payload:seed-admins -- "Dev <dev@example.com>" "Ryoko <ryoko@example.com>"
 *
 * Runs against whatever DATABASE_URL points at — a personal Neon branch, a
 * preview branch, a rebuilt production, a throwaway rehearsal branch — so any
 * environment can be brought to the same state by one command instead of four
 * trips through the admin UI.
 *
 * ── Idempotent by email ─────────────────────────────────────────────────────
 *
 * An account that already exists is left *completely* alone: not updated, not
 * renamed, and above all not re-passworded. The script reports created-versus-
 * existing per account and exits zero either way. That is what makes it safe to
 * re-run partway through a live cutover, where the first run may have died
 * halfway with two accounts made and two not.
 *
 * ── Passwords ───────────────────────────────────────────────────────────────
 *
 * Each new account gets a generated password with real entropy, printed to
 * stdout exactly once. Nothing is written to disk and nothing is emailed:
 * delivery is out-of-band through 1Password, and the password is temporary —
 * each admin changes it in the admin UI on first sign-in. Payload has no email
 * adapter and this script does not add one; Resend stays wired to Better Auth.
 *
 * ── Security side effect, on purpose ────────────────────────────────────────
 *
 * Payload's `create-first-user` bootstrap screen is unauthenticated: while zero
 * `cms_admins` rows exist, anyone who reaches /admin is offered a form that
 * makes them a full CMS admin. Creating the first account closes that window
 * permanently. Running this immediately after the first deploy — before the
 * content import — is the point, not a bonus (#32).
 *
 * Like the content import, this loads `.env.local` itself before importing the
 * Payload config, because the config reads PAYLOAD_SECRET at module scope and
 * Payload's CLI loadEnv does not cover script entrypoints.
 */

config({ path: ".env.local" });

// ── The roster ────────────────────────────────────────────────────────────────

/*
 * Held here as data. Adding a fifth editor is one line and a re-run:
 *
 *   { name: "Ryoko", email: "ryoko@example.com" },
 *
 * For someone who only needs an account once — or whose address is not settled
 * enough to commit — pass them on the command line instead, in the same
 * `Name <email>` form git uses:
 *
 *   npm run payload:seed-admins -- "Dev <dev@example.com>"
 *
 * Command-line entries behave exactly like roster entries, idempotency
 * included, so it is fine to add someone by flag now and by roster line later.
 */
type Admin = { name: string; email: string };

const ROSTER: Admin[] = [
  { name: "Justin Lee", email: "me@jlee.cool" },
  { name: "Sachi", email: "2631sachi@gmail.com" },
  { name: "Ryoko", email: "tsunoryoko@gmail.com" },
  // Dev: add a line once the address is confirmed.
];

// ── Passwords ─────────────────────────────────────────────────────────────────

/*
 * 24 characters from a 55-character alphabet is ~138 bits — far past anything
 * that needs arguing about, and the point is that no human ever invents one of
 * these under cutover pressure.
 *
 * The alphabet drops every character that gets misread when a password is read
 * off a screen or spoken aloud: i/l/I/1 and o/O/0. `randomInt` rejection-
 * samples, so there is no modulo bias across an alphabet that does not divide
 * 256.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_LENGTH = 24;

function generatePassword(): string {
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

// ── Input ─────────────────────────────────────────────────────────────────────

const USAGE = `Creates the Payload CMS admin accounts.

  npm run payload:seed-admins
  npm run payload:seed-admins -- "Dev <dev@example.com>" [more...]

Existing accounts are left untouched, so re-running is safe. Generated
passwords print once and are never written to disk.`;

/** Bad input rather than a failure: reported with the usage text, and exits 2. */
class UsageError extends Error {}

/*
 * Deliberately strict rather than clever: one @, no spaces, a dot in the
 * domain. A typo'd address here becomes a permanent row that the next run
 * politely reports as "existing", so it is worth catching before the write.
 */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Parses `Name <email>` or a bare `email`. Validation happens in `resolveRoster`. */
function parseAdmin(arg: string): Admin {
  const match = arg.match(/^\s*(.*?)\s*<\s*(.+?)\s*>\s*$/);
  const [name, email] = match ? [match[1], match[2]] : ["", arg.trim()];
  return { name: name || email.split("@")[0], email };
}

/*
 * Validates and de-duplicates the roster, and is the only place an address is
 * checked — roster lines and command-line entries go through it alike.
 *
 * Lowercasing is what keeps the idempotency claim honest: Payload stores and
 * matches emails lowercased, so `Me@jlee.cool` in the roster must find the row
 * that `me@jlee.cool` created rather than make a second one.
 */
function resolveRoster(admins: Admin[]): Admin[] {
  const byEmail = new Map<string, Admin>();
  for (const admin of admins) {
    const email = admin.email.trim().toLowerCase();
    if (!isEmail(email)) throw new UsageError(`Not an email address: ${admin.email}`);
    // First mention wins, so a roster line keeps its name over a duplicate flag.
    if (!byEmail.has(email)) byEmail.set(email, { name: admin.name.trim(), email });
  }
  return [...byEmail.values()];
}

/** Host and database from DATABASE_URL, so the operator can see the target — never the credentials. */
function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return;
  }

  /*
   * Both of these are checked before Payload is imported. Without the secret,
   * `buildConfig` receives "" and Payload fails somewhere deep in initialisation
   * with an error that does not mention the environment variable at all.
   */
  const missing = ["PAYLOAD_SECRET", "DATABASE_URL"].filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new UsageError(
      `${missing.join(" and ")} must be set — refusing to run.\n` +
        "  Locally these live in .env.local; see .env.example.\n" +
        "  In CI or on Vercel they come from the environment."
    );
  }

  const admins = resolveRoster([...ROSTER, ...args.map(parseAdmin)]);
  if (!admins.length) {
    throw new UsageError("Nothing to seed: the roster is empty and no accounts were passed.");
  }

  console.log(`Seeding ${admins.length} CMS admin(s) into ${describeTarget(process.env.DATABASE_URL!)}\n`);

  // Imported after dotenv above: the config reads PAYLOAD_SECRET at module scope.
  const { getPayload } = await import("payload");
  const { default: payloadConfig } = await import("../../src/payload.config");
  const payload = await getPayload({ config: payloadConfig });

  let created = 0;
  let existing = 0;

  try {
    for (const admin of admins) {
      const found = await payload.find({
        collection: "cms_admins",
        where: { email: { equals: admin.email } },
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      });

      // Untouched means untouched — no update, so an admin who has already
      // changed their password or their display name keeps both.
      if (found.docs.length) {
        existing++;
        console.log(`  = ${admin.email.padEnd(28)} already exists — left untouched`);
        continue;
      }

      const password = generatePassword();
      await payload.create({
        collection: "cms_admins",
        data: { email: admin.email, name: admin.name, password },
        depth: 0,
        overrideAccess: true,
      });
      created++;
      console.log(`  + ${admin.email.padEnd(28)} created`);
      console.log(`      password: ${password}`);
    }
  } finally {
    // Hands the connection pool back rather than leaving Neon to time out
    // half-open connections. It does not end the process — see `finish`.
    await payload.destroy();
  }

  console.log(`\n${created} created, ${existing} already existed.`);

  if (created) {
    console.log(
      "\nThe passwords above are shown once and are not stored anywhere.\n" +
        "  1. Put each one in 1Password and share it with its owner there.\n" +
        "  2. They sign in at /admin and change it immediately — these are temporary.\n" +
        "  3. /admin no longer offers unauthenticated first-user creation (#32)."
    );
  }
}

/*
 * Drains stdout, *then* exits. Both halves are load-bearing:
 *
 *  - The exit is required. Payload keeps handles open after `payload.destroy()`
 *    — measured: without an explicit exit this script finishes its work, prints
 *    everything, and then sits there forever, which in CI is a hung job.
 *  - The drain has to come first, because `process.exit` truncates a pipe
 *    mid-write and the generated passwords are the one output re-running cannot
 *    recover. `npm run payload:seed-admins | tee admins.txt` must not lose them.
 *
 * Exit codes:
 *   0  seeded (or nothing left to do)
 *   1  failed partway
 *   2  bad input or missing environment — nothing was attempted
 */
async function finish(code: number): Promise<never> {
  await new Promise<void>((resolve) => process.stdout.write("", () => resolve()));
  process.exit(code);
}

main().then(
  () => finish(0),
  (err) => {
    if (err instanceof UsageError) {
      console.error(`✗ ${err.message}`);
      console.error(`\n${USAGE}`);
      return finish(2);
    }
    // A crash after some accounts were made is survivable precisely because of
    // the idempotency above: fix the cause, run it again, and the accounts that
    // landed are skipped.
    console.error("\n✗ Seeding failed:", err instanceof Error ? err.message : err);
    console.error("  Re-run once the cause is fixed — accounts already created are skipped.");
    return finish(1);
  }
);
