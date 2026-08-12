/**
 * Survey the source MongoDB before migrating anything.
 *
 *   npx tsx scripts/migrate/00-survey.ts
 *
 * Read-only. Answers the question MIGRATION_EVALUATION.md left open — how much
 * real content actually exists — and sizes the JSON bodies against Airtable's
 * long-text limit so migration 01 can't be surprised.
 */
import { config } from "dotenv";
import { connectMongo } from "./lib/mongo";
import { MAX_LONG_TEXT } from "./lib/airtable";

config({ path: ".env.local" });

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
      if (size > MAX_LONG_TEXT) console.log(`      ⚠️  exercises JSON exceeds the Airtable long-text limit`);
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
      if (size > MAX_LONG_TEXT) console.log(`      ⚠️  items JSON exceeds the Airtable long-text limit`);
    }

    console.log("\n── Resources ──");
    const resources = await db.collection("resources").find({}).toArray();
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
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
