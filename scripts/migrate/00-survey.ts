/**
 * Survey the source MongoDB before migrating anything.
 *
 *   npx tsx scripts/migrate/00-survey.ts
 *   npm run migrate:survey:dump      # also writes content/mongo-snapshot/
 *
 * Read-only. Answers the question docs/MIGRATION_EVALUATION.md left open — how much
 * real content actually exists. The JSON body sizes it prints were originally
 * measured against Airtable's long-text limit; Airtable is retired (#26) and
 * Payload stores content as real fields, so they are now just a sense of scale.
 *
 * `--dump` writes the four source collections out verbatim. MongoDB is
 * decommissioned on 2026-09-15 (docs/DECOMMISSION.md), and after that date
 * `01-content-to-payload.ts` has nothing to read: the dump is what keeps the
 * original import re-runnable, and what any future argument about "what did the
 * source actually say" gets settled against. Verbatim on purpose — same reason
 * `lib/mongo.ts` uses the raw driver rather than Mongoose.
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectMongo } from "./lib/mongo";

config({ path: ".env.local" });

const DUMP = process.argv.includes("--dump");
const DUMP_DIR = path.resolve("content/mongo-snapshot");
/** The collections the content import reads. `Resource` is capitalised. */
const DUMP_COLLECTIONS = ["lessons", "newlessons", "Resource"];

const PLACEHOLDER = /placeholder/i;

function countPlaceholders(value: unknown): { urls: number; placeholders: number } {
  let urls = 0;
  let placeholders = 0;

  const walk = (node: unknown) => {
    if (typeof node === "string") {
      if (/^https?:\/\//i.test(node)) urls++;
      else if (PLACEHOLDER.test(node)) placeholders++;
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") return Object.values(node).forEach(walk);
  };

  walk(value);
  return { urls, placeholders };
}

async function main() {
  const { db, close } = await connectMongo();

  try {
    const collections = await db.listCollections().toArray();
    console.log(`Database: ${db.databaseName}`);
    console.log(`Collections: ${collections.length}\n`);

    for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await db.collection(name).countDocuments();
      console.log(`  ${name.padEnd(20)} ${String(count).padStart(5)} docs`);
    }

    console.log("\n── Lessons (legacy) ──");
    const lessons = await db.collection("lessons").find({}).toArray();
    for (const doc of lessons) {
      const exercises = Array.isArray(doc.exercises) ? doc.exercises.length : 0;
      const flashcards = Array.isArray(doc.flashcards) ? doc.flashcards.length : 0;
      const size = JSON.stringify(doc.exercises ?? []).length;
      console.log(
        `  ${String(doc.slug).padEnd(28)} pref=${String(doc.prefecture ?? "-").padEnd(12)} ` +
          `cards=${String(flashcards).padStart(3)} ex=${String(exercises).padStart(3)} ` +
          `active=${doc.isActive !== false ? "y" : "n"} json=${size}`
      );
    }

    console.log("\n── NewLessons (grammar) ──");
    const newLessons = await db.collection("newlessons").find({}).toArray();
    for (const doc of newLessons) {
      const items = Array.isArray(doc.items) ? doc.items : [];
      const size = JSON.stringify(items).length;
      const types = items.reduce<Record<string, number>>((acc, item: any) => {
        const type = String(item?.type ?? "?");
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
      }, {});
      const media = countPlaceholders(items);

      console.log(
        `  ${String(doc.slug).padEnd(28)} items=${String(items.length).padStart(3)} ` +
          `json=${String(size).padStart(6)} media=${media.urls} placeholder=${media.placeholders} ` +
          `next=${doc.nextSlug || "-"} active=${doc.isActive !== false ? "y" : "n"}`
      );
      console.log(
        `      ${Object.entries(types).map(([t, n]) => `${t}:${n}`).join("  ") || "(no items)"}`
      );
    }

    console.log("\n── Resources ──");
    // The live collection is "Resource" (capitalised, singular) — the lowercase
    // "resources" that Mongoose would normally create is empty.
    const resources = await db.collection("Resource").find({}).toArray();
    for (const doc of resources) {
      const items = Array.isArray(doc.items) ? doc.items.length : 0;
      console.log(`  ${String(doc.id ?? doc._id).padEnd(28)} category=${doc.category} items=${items}`);
    }

    console.log("\n── Users & progress ──");
    const users = await db.collection("users").find({}).toArray();
    const bcrypt = users.filter((u: any) => String(u.password ?? "").startsWith("$2")).length;
    const plaintext = users.length - bcrypt;
    console.log(`  users:    ${users.length} (${bcrypt} bcrypt, ${plaintext} NOT bcrypt)`);
    if (plaintext > 0) {
      console.log("    ⚠️  non-bcrypt passwords must be hashed during migration 02");
    }

    for (const name of ["userprogresses", "attempts", "reviewitems"]) {
      const exists = collections.some((c) => c.name === name);
      if (exists) {
        console.log(`  ${name}: ${await db.collection(name).countDocuments()}`);
      }
    }

    if (DUMP) {
      console.log(`\n── Dump → ${path.relative(process.cwd(), DUMP_DIR)} ──`);
      mkdirSync(DUMP_DIR, { recursive: true });
      for (const name of DUMP_COLLECTIONS) {
        if (!collections.some((c) => c.name === name)) {
          console.log(`  ${name.padEnd(12)} (absent — skipped)`);
          continue;
        }
        // Sorted by _id so a re-dump of unchanged data produces no diff.
        const docs = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
        writeFileSync(
          path.join(DUMP_DIR, `${name}.json`),
          `${JSON.stringify(docs, null, 2)}\n`
        );
        console.log(`  ${name.padEnd(12)} ${String(docs.length).padStart(4)} docs`);
      }
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
