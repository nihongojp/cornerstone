/**
 * Migration 02 — user accounts: MongoDB → Postgres (Better Auth schema).
 *
 *   npx tsx scripts/migrate/02-users-to-postgres.ts [--dry-run]
 *
 * Needs MONGODB_URI and DATABASE_URL in .env.local.
 *
 * Existing passwords keep working: the bcrypt hash written by the old Mongoose
 * pre-save hook is copied verbatim into Better Auth's account.password, and
 * auth.ts branches on the "$2" prefix to verify it. Nobody is forced to reset.
 *
 * Idempotent: the Postgres user id IS the Mongo _id hex, so re-running updates
 * the same rows instead of duplicating them — and migration 03 can map progress
 * to users without a lookup table.
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { connectMongo } from "./lib/mongo";

config({ path: ".env.local" });

// Test accounts found in the production `users` collection. They are not real
// people and must not become real users in the new database.
const TEST_EMAIL_PATTERNS = [
  /^claude-test-/i,
  /^pronun-smoke-test@/i,
  /@example\.com$/i,
];

function isTestAccount(email: string): boolean {
  return TEST_EMAIL_PATTERNS.some((re) => re.test(email));
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]?\$/.test(value);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { db, close } = await connectMongo();

  // Imported lazily so --dry-run works without a reachable Postgres.
  const { db: pg } = await import("../../src/lib/db");
  const { user, account } = await import("../../src/lib/db/schema");

  try {
    // Deliberately NOT the capitalised legacy `User` collection: it is a
    // superseded duplicate whose emails already exist here.
    const docs = await db.collection("users").find({}).toArray();
    console.log(`Read ${docs.length} users from Mongo\n`);

    let migrated = 0;
    const skipped: string[] = [];

    for (const doc of docs) {
      const email = String(doc.email || "").trim().toLowerCase();
      const id = String(doc._id);

      if (!email) {
        skipped.push(`${id} (no email)`);
        continue;
      }
      if (isTestAccount(email)) {
        skipped.push(`${email} (test account)`);
        continue;
      }

      const stored = String(doc.password || "");
      let passwordHash: string;

      if (isBcryptHash(stored)) {
        passwordHash = stored;
      } else if (stored) {
        // The old login controller accepted plaintext passwords and upgraded
        // them on next sign-in. Better Auth has no such path, so hash it here
        // or the account could never be signed into again.
        passwordHash = await bcrypt.hash(stored, 10);
        console.log(`  ! ${email}: password was not bcrypt — hashed during import`);
      } else {
        skipped.push(`${email} (no password)`);
        continue;
      }

      const firstName = doc.firstName ?? null;
      const lastName = doc.lastName ?? null;
      const name = [firstName, lastName].filter(Boolean).join(" ") || email;
      const createdAt = doc.createdAt ? new Date(doc.createdAt) : new Date();
      const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : createdAt;

      console.log(`  → ${email.padEnd(32)} ${isBcryptHash(stored) ? "bcrypt" : "hashed"}  id=${id}`);

      if (dryRun) {
        migrated++;
        continue;
      }

      await pg
        .insert(user)
        .values({
          id,
          name,
          email,
          // These accounts predate any verification flow, and email
          // verification is not enabled — marking them verified avoids
          // locking existing users out.
          emailVerified: true,
          firstName,
          lastName,
          role: doc.role ?? "Volunteer",
          createdAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: user.id,
          set: { name, email, firstName, lastName, updatedAt },
        });

      await pg
        .insert(account)
        .values({
          id: `acct_${id}`,
          accountId: id,
          providerId: "credential",
          userId: id,
          password: passwordHash,
          createdAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: account.id,
          set: { password: passwordHash, updatedAt },
        });

      migrated++;
    }

    console.log(
      `\n${dryRun ? "[dry run] would migrate" : "Migrated"} ${migrated} user(s); skipped ${skipped.length}`
    );
    for (const s of skipped) console.log(`  skipped: ${s}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
