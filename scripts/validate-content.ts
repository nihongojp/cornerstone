import { config } from "dotenv";
import { connectMongo } from "./migrate/lib/mongo";
import {
  GrammarLessonSchema,
  LegacyLessonSchema,
  ResourceGroupSchema,
  GrammarComponentSchema,
  LegacyExerciseSchema,
  isPlaceholderUrl,
  classifyPage,
  isDragAndDropPuzzle,
  KNOWN_GRAMMAR_TYPES,
  KNOWN_LEGACY_TYPES,
} from "../src/lib/content/item-schemas";

/*
 * Validates the real source content against the zod schemas.
 *
 * This exists instead of unit tests over synthetic fixtures: the schemas are
 * only useful insofar as they describe the content that actually exists, and
 * the content is the thing that changes. The import script (01-content-to-
 * payload) reuses the same schemas, so a clean run here is the precondition
 * for a clean import.
 *
 * Read-only. Exits non-zero if anything fails to validate.
 */

config({ path: ".env.local" });

type Counter = Record<string, number>;

function bump(c: Counter, key: string) {
  c[key] = (c[key] ?? 0) + 1;
}

function formatIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues
    .slice(0, 5)
    .map((i) => `      ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

async function main() {
  const { db, close } = await connectMongo();
  let failures = 0;

  const componentTypes: Counter = {};
  const legacyTypes: Counter = {};
  const pageVariants: Counter = {};
  const placeholders: Counter = {};
  let dragDropPuzzles = 0;
  let dragDropSeeds = 0;

  console.log(`\nValidating content in database "${db.databaseName}"\n`);

  // ── Legacy lessons ──────────────────────────────────────────────────────────
  const legacy = await db.collection("lessons").find({}).toArray();
  console.log(`legacy lessons: ${legacy.length}`);
  for (const doc of legacy) {
    const parsed = LegacyLessonSchema.safeParse(doc);
    if (!parsed.success) {
      failures++;
      console.log(`  ✗ ${doc.slug ?? doc._id}\n${formatIssues(parsed.error)}`);
      // still count the exercises we can, to give a fuller picture in one run
      for (const ex of (doc.exercises ?? []) as Array<{ type?: string }>) {
        bump(legacyTypes, String(ex?.type ?? "(missing type)"));
      }
      continue;
    }
    for (const ex of parsed.data.exercises) {
      bump(legacyTypes, ex.type);
      const single = LegacyExerciseSchema.safeParse(ex);
      if (!single.success) failures++;
      for (const [k, v] of Object.entries(ex)) {
        if (k.toLowerCase().includes("url") && isPlaceholderUrl(v)) bump(placeholders, ex.type);
      }
    }
    console.log(
      `  ✓ ${parsed.data.slug} — ${parsed.data.exercises.length} exercises, ` +
        `${parsed.data.flashcards.length} flashcards` +
        (parsed.data.flashcardsAudio ? "" : " (no flashcardsAudio)")
    );
  }

  // ── Grammar lessons ─────────────────────────────────────────────────────────
  const grammar = await db.collection("newlessons").find({}).toArray();
  console.log(`\ngrammar lessons: ${grammar.length}`);
  for (const doc of grammar) {
    const parsed = GrammarLessonSchema.safeParse(doc);
    if (!parsed.success) {
      failures++;
      console.log(`  ✗ ${doc.slug ?? doc._id}\n${formatIssues(parsed.error)}`);
      // Re-walk items individually so one bad item doesn't hide the rest.
      for (const [idx, item] of ((doc.items ?? []) as unknown[]).entries()) {
        const one = GrammarComponentSchema.safeParse(item);
        const type = (item as { type?: string })?.type ?? "(missing type)";
        bump(componentTypes, String(type));
        if (!one.success) console.log(`      items[${idx}] (${type}) invalid`);
      }
      continue;
    }
    for (const item of parsed.data.items) {
      bump(componentTypes, item.type);
      if (item.type === "page") bump(pageVariants, classifyPage(item));
      if (item.type === "dragAndDropExercise") {
        isDragAndDropPuzzle(item) ? dragDropPuzzles++ : dragDropSeeds++;
      }
      for (const [k, v] of Object.entries(item)) {
        if (k.toLowerCase().includes("url") && isPlaceholderUrl(v)) bump(placeholders, item.type);
      }
    }
    console.log(`  ✓ ${parsed.data.slug} — ${parsed.data.items.length} items`);
  }

  // ── Resources ───────────────────────────────────────────────────────────────
  const resources = await db.collection("Resource").find({}).toArray();
  console.log(`\nresource groups: ${resources.length}`);
  for (const doc of resources) {
    const parsed = ResourceGroupSchema.safeParse(doc);
    if (!parsed.success) {
      failures++;
      console.log(`  ✗ ${doc.category ?? doc._id}\n${formatIssues(parsed.error)}`);
    }
  }
  if (resources.every((d) => ResourceGroupSchema.safeParse(d).success)) {
    console.log(`  ✓ all ${resources.length} valid`);
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const table = (title: string, counter: Counter, known: readonly string[]) => {
    console.log(`\n${title}`);
    const entries = Object.entries(counter).sort((a, b) => b[1] - a[1]);
    if (!entries.length) console.log("  (none)");
    for (const [type, n] of entries) {
      const flag = known.includes(type) ? "" : "  ← UNKNOWN TYPE, would import as legacyJson";
      console.log(`  ${String(n).padStart(3)}  ${type}${flag}`);
    }
  };

  table("grammar component types:", componentTypes, KNOWN_GRAMMAR_TYPES);
  table("legacy exercise types:", legacyTypes, KNOWN_LEGACY_TYPES);

  console.log("\npage variants (the three shapes hiding behind one type):");
  for (const [v, n] of Object.entries(pageVariants)) console.log(`  ${String(n).padStart(3)}  ${v}`);

  console.log(
    `\ndragAndDropExercise: ${dragDropPuzzles} real puzzles, ${dragDropSeeds} media seeds ` +
      `(seeds fed the old generator and are probably not exercises at all)`
  );

  const placeholderTotal = Object.values(placeholders).reduce((a, b) => a + b, 0);
  console.log(`\nitems carrying at least one placeholder media URL: ${placeholderTotal}`);
  for (const [type, n] of Object.entries(placeholders).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${type}`);
  }
  console.log("  (the import drops these to empty so the gaps are visible — see #27)");

  await close();

  console.log(
    failures === 0
      ? "\n✓ all content validates against the schemas\n"
      : `\n✗ ${failures} validation failure(s)\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
