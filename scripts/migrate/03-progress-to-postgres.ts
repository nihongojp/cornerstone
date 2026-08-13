/**
 * Migration 03 — lesson progress: MongoDB → Postgres.
 *
 *   npx tsx scripts/migrate/03-progress-to-postgres.ts [--dry-run]
 *
 * Run AFTER 02: progress rows are keyed to user ids, and 02 reuses the Mongo
 * _id hex as the Postgres user id, so no lookup table is needed.
 *
 * Rows are skipped when their user did not migrate — the live data references
 * several users that no longer exist in the `users` collection, plus the test
 * accounts 02 filters out. Skips are listed rather than silently dropped.
 *
 * Idempotent: upserts on the (user_id, lesson_id) unique index, keeping
 * whichever row was updated most recently.
 */
import { config } from "dotenv";
import { connectMongo } from "./lib/mongo";

config({ path: ".env.local" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { db, close } = await connectMongo();

  const { db: pg } = await import("../../src/lib/db");
  const { userProgress, user } = await import("../../src/lib/db/schema");

  try {
    const docs = await db.collection("userprogresses").find({}).toArray();
    console.log(`Read ${docs.length} progress rows from Mongo`);

    // Which users actually exist in Postgres after migration 02.
    const existing = dryRun ? [] : await pg.select({ id: user.id }).from(user);
    const knownUsers = new Set(existing.map((u) => u.id));
    if (!dryRun) console.log(`${knownUsers.size} users present in Postgres\n`);

    let migrated = 0;
    const skipped: string[] = [];

    for (const doc of docs) {
      const userId = String(doc.userId ?? "");
      const lessonId = String(doc.lessonId ?? "").trim();

      if (!userId || !lessonId) {
        skipped.push(`${doc._id} (missing userId or lessonId)`);
        continue;
      }
      if (!dryRun && !knownUsers.has(userId)) {
        skipped.push(`${lessonId} (user ${userId} not migrated)`);
        continue;
      }

      const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : new Date();
      const values = {
        userId,
        lessonId,
        status: doc.status === "completed" ? ("completed" as const) : ("in_progress" as const),
        lastStep: Number.isFinite(doc.lastStep) ? Math.max(0, Number(doc.lastStep)) : 0,
        // Opaque content-derived resume key — copied verbatim, never parsed.
        stepKey: typeof doc.stepKey === "string" ? doc.stepKey : "",
        accuracyPct: Number.isFinite(doc.accuracyPct)
          ? Math.min(100, Math.max(0, Number(doc.accuracyPct)))
          : 0,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : updatedAt,
        updatedAt,
      };

      if (dryRun) {
        console.log(`  → ${lessonId.padEnd(28)} step=${values.lastStep} ${values.status}`);
        migrated++;
        continue;
      }

      await pg
        .insert(userProgress)
        .values(values)
        .onConflictDoUpdate({
          target: [userProgress.userId, userProgress.lessonId],
          set: {
            status: values.status,
            lastStep: values.lastStep,
            stepKey: values.stepKey,
            accuracyPct: values.accuracyPct,
            updatedAt: values.updatedAt,
          },
        });

      migrated++;
    }

    console.log(
      `\n${dryRun ? "[dry run] would migrate" : "Migrated"} ${migrated} row(s); skipped ${skipped.length}`
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
