/**
 * Migration 01 — lesson content: MongoDB → Airtable.
 *
 *   npx tsx scripts/migrate/01-content-to-airtable.ts
 *
 * Needs MONGODB_URI, AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env.local.
 * The Airtable token needs data.records:write for this script (the running app
 * only ever needs read).
 *
 * Idempotent: records are upserted on Slug (Resources on ResourceId), so the
 * rehearsal run and the cutover run produce the same records rather than
 * duplicates. After writing, it re-reads everything and compares against the
 * Mongo source, because a silently mangled lesson is worse than a failed run.
 */
import { config } from "dotenv";
import { connectMongo } from "./lib/mongo";
import { upsertRecords, listAllRecords, assertFits, jsonField } from "./lib/airtable";

config({ path: ".env.local" });

type AnyDoc = Record<string, any>;

function lessonFields(doc: AnyDoc): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    Slug: doc.slug,
    Title: doc.title ?? "",
    CardTitle: doc.cardTitle ?? "",
    Version: doc.version ?? "",
    Prefecture: doc.prefecture ?? "",
    FunFact: doc.funFact ?? "",
    Notes: doc.notes ?? "",
    Flashcards: jsonField(doc.flashcards),
    FlashcardsAudio: jsonField(doc.flashcardsAudio),
    Exercises: jsonField(doc.exercises),
    Achievement: jsonField(doc.achievement),
    IsActive: doc.isActive !== false,
    Tags: jsonField(doc.tags),
    SourceId: String(doc._id),
  };

  for (const key of ["Flashcards", "FlashcardsAudio", "Exercises", "Achievement", "Tags"]) {
    const value = fields[key];
    if (typeof value === "string") assertFits(`Lessons/${doc.slug}`, key, value);
  }
  return fields;
}

function newLessonFields(doc: AnyDoc): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    Slug: doc.slug,
    Lesson: doc.lesson ?? "",
    CardTitle: doc.cardTitle ?? "",
    Items: jsonField(doc.items),
    NextSlug: doc.nextSlug ?? "",
    IsActive: doc.isActive !== false,
    Tags: jsonField(doc.tags),
    SourceId: String(doc._id),
  };

  for (const key of ["Items", "Tags"]) {
    const value = fields[key];
    if (typeof value === "string") assertFits(`NewLessons/${doc.slug}`, key, value);
  }
  return fields;
}

function resourceFields(doc: AnyDoc): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    ResourceId: String(doc.id ?? doc._id),
    Category: doc.category ?? "",
    Items: jsonField(doc.items),
  };
  const items = fields.Items;
  if (typeof items === "string") assertFits(`Resources/${fields.ResourceId}`, "Items", items);
  return fields;
}

/*
 * The Achievement catalog is real design work that no code reads yet — the
 * players only use the achievement embedded in each lesson. It comes across so
 * the design outlives the Mongo cluster; wiring up the feature is out of scope.
 */
function achievementFields(doc: AnyDoc): Record<string, unknown> {
  return {
    AchievementId: String(doc.achievementId ?? doc._id),
    Title: doc.title ?? "",
    XP: typeof doc.xp === "number" ? doc.xp : 0,
    Icon: doc.icon ?? "",
    SourceId: String(doc._id),
  };
}

/** Compares what Airtable now holds against the Mongo source. */
function verify(
  label: string,
  sourceDocs: AnyDoc[],
  airtableRecords: Array<{ fields: Record<string, unknown> }>,
  keyOf: (doc: AnyDoc) => string,
  recordKeyField: string,
  jsonChecks: Array<{ field: string; sourceKey: string }>
): number {
  const byKey = new Map(
    airtableRecords.map((r) => [String(r.fields[recordKeyField] ?? ""), r.fields])
  );
  let problems = 0;

  for (const doc of sourceDocs) {
    const key = keyOf(doc);
    const fields = byKey.get(key);

    if (!fields) {
      console.error(`  ✗ ${label} ${key}: missing from Airtable`);
      problems++;
      continue;
    }

    for (const { field, sourceKey } of jsonChecks) {
      const raw = fields[field];
      const source = doc[sourceKey];
      const sourceEmpty =
        source === undefined || source === null || (Array.isArray(source) && source.length === 0);

      if (typeof raw !== "string" || raw === "") {
        if (!sourceEmpty) {
          console.error(`  ✗ ${label} ${key}: ${field} is empty but Mongo has data`);
          problems++;
        }
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error(`  ✗ ${label} ${key}: ${field} did not survive as valid JSON`);
        problems++;
        continue;
      }

      if (JSON.stringify(parsed) !== JSON.stringify(source)) {
        console.error(`  ✗ ${label} ${key}: ${field} differs from the Mongo source`);
        problems++;
      }
    }
  }

  return problems;
}

async function main() {
  const { db, close } = await connectMongo();

  try {
    const lessons = await db.collection("lessons").find({}).toArray();
    const newLessons = await db.collection("newlessons").find({}).toArray();
    // "Resource", capitalised and singular — that's what the live database
    // actually uses. The lowercase "resources" collection Mongoose would
    // normally create exists but is empty, so reading it silently migrates
    // nothing.
    const resources = await db.collection("Resource").find({}).toArray();
    const achievements = await db.collection("Achievement").find({}).toArray();

    console.log(
      `Read from Mongo: ${lessons.length} lessons, ${newLessons.length} newlessons, ` +
        `${resources.length} resources, ${achievements.length} achievements`
    );

    if (lessons.length) {
      const result = await upsertRecords(
        "Lessons",
        ["Slug"],
        lessons.map((doc) => ({ fields: lessonFields(doc) }))
      );
      console.log(`Lessons     → created ${result.created}, updated ${result.updated}`);
    }

    if (newLessons.length) {
      const result = await upsertRecords(
        "NewLessons",
        ["Slug"],
        newLessons.map((doc) => ({ fields: newLessonFields(doc) }))
      );
      console.log(`NewLessons  → created ${result.created}, updated ${result.updated}`);
    }

    if (resources.length) {
      const result = await upsertRecords(
        "Resources",
        ["ResourceId"],
        resources.map((doc) => ({ fields: resourceFields(doc) }))
      );
      console.log(`Resources   → created ${result.created}, updated ${result.updated}`);
    }

    if (achievements.length) {
      const result = await upsertRecords(
        "Achievements",
        ["AchievementId"],
        achievements.map((doc) => ({ fields: achievementFields(doc) }))
      );
      console.log(`Achievements→ created ${result.created}, updated ${result.updated}`);
    }

    console.log("\nVerifying round trip…");
    const problems =
      verify("lesson", lessons, await listAllRecords("Lessons"), (d) => d.slug, "Slug", [
        { field: "Flashcards", sourceKey: "flashcards" },
        { field: "Exercises", sourceKey: "exercises" },
      ]) +
      verify("newlesson", newLessons, await listAllRecords("NewLessons"), (d) => d.slug, "Slug", [
        { field: "Items", sourceKey: "items" },
      ]) +
      verify(
        "resource",
        resources,
        await listAllRecords("Resources"),
        (d) => String(d.id ?? d._id),
        "ResourceId",
        [{ field: "Items", sourceKey: "items" }]
      );

    if (problems > 0) {
      console.error(`\n${problems} problem(s) found — do not cut over until these are resolved.`);
      process.exitCode = 1;
    } else {
      console.log("All records round-tripped cleanly.");
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
