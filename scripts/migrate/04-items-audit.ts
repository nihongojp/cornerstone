/**
 * Audit the shape of every lesson content item in MongoDB.
 *
 *   npx tsx scripts/migrate/04-items-audit.ts > scripts/migrate/out/items-audit.md
 *
 * Read-only. This is CMS handoff Task 0: the Mongo `newlessons` model is
 * `strict: false`, so the real item-type vocabulary is only discoverable from
 * the data. The output of this script defines the initial Payload component
 * block set and the zod schemas, so it has to be exhaustive rather than
 * illustrative.
 *
 * Mongo is the only store surveyed. An earlier revision of this script also
 * profiled Airtable and concluded the import had to source legacy lessons from
 * there — #26 reversed that: Airtable is retired and the content unique to it
 * was deliberately dropped. The Airtable half has been removed rather than left
 * to mislead the next reader; `out/items-audit.md` is the record of what it
 * found. See the store-inventory note below.
 */
import { config } from "dotenv";
import { connectMongo } from "./lib/mongo";

// `quiet` keeps dotenv's banner off stdout — this script's stdout IS the report.
config({ path: ".env.local", quiet: true });

/* ── shape profiling ────────────────────────────────────────────────── */

type FieldStat = {
  present: number;
  types: Map<string, number>;
  examples: unknown[];
  /** For arrays: observed lengths, and the element types seen inside. */
  arrayLengths: number[];
  arrayElementTypes: Set<string>;
  /**
   * For arrays of objects (and plain object values): the shape of the nested
   * element. A field with a nested shape cannot be a scalar Payload field —
   * it needs its own `array` field or sub-block, which is the single most
   * important thing this audit has to surface.
   */
  nested: Map<string, FieldStat> | null;
  nestedCount: number;
};

type TypeStat = {
  occurrences: number;
  /** Document slugs the type was seen in. */
  docs: Set<string>;
  fields: Map<string, FieldStat>;
  /** Whole representative item, for the example block. */
  sample: unknown;
};

/** Coarse runtime type label, deliberately finer than typeof for arrays/null. */
function kindOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value === undefined) return "undefined";
  return typeof value;
}

function emptyField(): FieldStat {
  return {
    present: 0,
    types: new Map(),
    examples: [],
    arrayLengths: [],
    arrayElementTypes: new Set(),
    nested: null,
    nestedCount: 0,
  };
}

/** Folds one nested object's keys into a field's `nested` sub-profile. */
function recordNested(stat: FieldStat, obj: Record<string, unknown>) {
  stat.nested ??= new Map();
  stat.nestedCount++;
  for (const [key, value] of Object.entries(obj)) {
    let sub = stat.nested.get(key);
    if (!sub) {
      sub = emptyField();
      stat.nested.set(key, sub);
    }
    recordField(sub, value);
  }
}

function recordField(stat: FieldStat, value: unknown) {
  stat.present++;
  const kind = kindOf(value);
  stat.types.set(kind, (stat.types.get(kind) ?? 0) + 1);

  if (Array.isArray(value)) {
    stat.arrayLengths.push(value.length);
    for (const el of value) {
      stat.arrayElementTypes.add(kindOf(el));
      if (el && typeof el === "object" && !Array.isArray(el)) {
        recordNested(stat, el as Record<string, unknown>);
      }
    }
  } else if (value && typeof value === "object") {
    recordNested(stat, value as Record<string, unknown>);
  }

  // Keep a handful of distinct examples; prefer non-empty ones.
  const serialized = JSON.stringify(value);
  const seen = stat.examples.map((e) => JSON.stringify(e));
  if (!seen.includes(serialized) && stat.examples.length < 3) {
    stat.examples.push(value);
  }
}

class Profiler {
  readonly types = new Map<string, TypeStat>();
  total = 0;

  add(item: unknown, docKey: string) {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const typeName = String(record.type ?? "(missing type field)");

    let stat = this.types.get(typeName);
    if (!stat) {
      stat = { occurrences: 0, docs: new Set(), fields: new Map(), sample: item };
      this.types.set(typeName, stat);
    }

    stat.occurrences++;
    this.total++;
    stat.docs.add(docKey);

    // Prefer the sample with the most keys — the richest instance shows the
    // widest field set at a glance.
    if (Object.keys(record).length > Object.keys(stat.sample as object).length) {
      stat.sample = item;
    }

    for (const [key, value] of Object.entries(record)) {
      let field = stat.fields.get(key);
      if (!field) {
        field = emptyField();
        stat.fields.set(key, field);
      }
      recordField(field, value);
    }
  }

  /** Every field name seen on any type, for contract-gap comparison. */
  allFields(): Set<string> {
    const out = new Set<string>();
    for (const stat of this.types.values()) {
      for (const key of stat.fields.keys()) out.add(key);
    }
    return out;
  }
}

/* ── markdown rendering ─────────────────────────────────────────────── */

function truncate(text: string, max = 160): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function cell(value: unknown): string {
  return truncate(JSON.stringify(value) ?? "undefined")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function renderType(name: string, stat: TypeStat, label: string) {
  console.log(`\n#### \`${name}\` — ${stat.occurrences} occurrences in ${stat.docs.size} ${label}\n`);
  console.log(`Appears in: ${[...stat.docs].sort().map((d) => `\`${d}\``).join(", ")}\n`);
  console.log(`| field | present | required? | observed types | example |`);
  console.log(`| --- | --- | --- | --- | --- |`);

  const rows = [...stat.fields.entries()].sort((a, b) => b[1].present - a[1].present);
  for (const [field, f] of rows) {
    const required = f.present === stat.occurrences ? "**always**" : "optional";
    let types = [...f.types.entries()].map(([t, n]) => `${t} (${n})`).join(", ");
    if (f.arrayLengths.length) {
      const min = Math.min(...f.arrayLengths);
      const max = Math.max(...f.arrayLengths);
      const els = [...f.arrayElementTypes].join("/") || "empty";
      types += ` — len ${min}–${max}, of ${els}`;
    }
    console.log(
      `| \`${field}\` | ${f.present}/${stat.occurrences} | ${required} | ${types} | ${cell(f.examples[0])} |`
    );
  }

  // Nested shapes decide whether a field can be a scalar Payload field or
  // needs its own array/sub-block, so they get their own tables.
  const nestedRows = rows.filter(([, f]) => f.nested && f.nested.size);
  for (const [field, f] of nestedRows) {
    console.log(
      `\n**Nested shape of \`${field}\`** — ${f.nestedCount} objects observed. ` +
        `_Not a scalar: needs an array/sub-block in Payload._\n`
    );
    console.log(`| sub-field | present | required? | observed types | example |`);
    console.log(`| --- | --- | --- | --- | --- |`);
    for (const [sub, s] of [...f.nested!.entries()].sort((a, b) => b[1].present - a[1].present)) {
      let t = [...s.types.entries()].map(([k, n]) => `${k} (${n})`).join(", ");
      if (s.arrayLengths.length) {
        t += ` — len ${Math.min(...s.arrayLengths)}–${Math.max(...s.arrayLengths)}`;
      }
      const req = s.present === f.nestedCount ? "**always**" : "optional";
      console.log(`| \`${sub}\` | ${s.present}/${f.nestedCount} | ${req} | ${t} | ${cell(s.examples[0])} |`);
    }
  }

  console.log(`\n<details><summary>Representative <code>${name}</code> item</summary>\n`);
  console.log("```json");
  console.log(JSON.stringify(stat.sample, null, 2));
  console.log("```\n");
  console.log("</details>");
}

function renderProfiler(title: string, p: Profiler, label: string) {
  console.log(`\n### ${title}\n`);
  if (!p.types.size) {
    console.log("_No items found._");
    return;
  }
  console.log(`| type | occurrences | ${label} |`);
  console.log(`| --- | --- | --- |`);
  for (const [name, stat] of [...p.types.entries()].sort((a, b) => b[1].occurrences - a[1].occurrences)) {
    console.log(`| \`${name}\` | ${stat.occurrences} | ${stat.docs.size} |`);
  }
  for (const [name, stat] of [...p.types.entries()].sort((a, b) => b[1].occurrences - a[1].occurrences)) {
    renderType(name, stat, label);
  }
}

/* ── the audit ──────────────────────────────────────────────────────── */

/** Item types named in code or code comments (src/lib/types/lessons.ts, the
 *  Mongo model comment, and the player switch statements). */
const TYPES_IN_CODE_NEWLESSONS = [
  "page",
  "matchingExercise",
  "dragAndDropExercise",
  "infoBreak",
  "lifeUsefulFact",
  "pronunciationExercise",
  "matchAudioExercise",
];

/** Legacy exercise types in the LessonExercise union in src/lib/types/lessons.ts. */
const TYPES_IN_CODE_LEGACY = [
  "connectTheDots",
  "matchAudioLetter",
  "vocabulary_drag_drop",
  "factBreak",
];

/** Top-level document fields declared in src/lib/types/lessons.ts. */
const CONTRACT_LESSON_FIELDS = new Set([
  "_id", "slug", "title", "version", "cardTitle", "flashcards", "flashcardsAudio",
  "funFact", "notes", "exercises", "achievement", "prefecture", "isActive", "tags",
]);
const CONTRACT_NEWLESSON_FIELDS = new Set([
  "_id", "lesson", "slug", "cardTitle", "isActive", "tags", "items", "nextSlug",
]);

/** Fields the LessonExercise union declares, unioned across its members. */
const CONTRACT_EXERCISE_FIELDS = new Set([
  "exerciseId", "type", "items", "correctAnswers", "prompt", "audioUrl",
  "characterBank", "correctAnswer", "imageUrl", "image", "bonus", "title", "content",
]);

/**
 * Hand-written analysis. Everything above is derived mechanically from the
 * data; this section is the judgement call about what it means for Payload,
 * and is the part a reviewer should argue with.
 */
const HAZARDS = `
---

## Modelling hazards

Ordered by how much they threaten a flat \`Course > Lesson > Exercise > Component\` block model.

### 1. The stored items are not the rendered items (blocking)

\`src/utils/expandLessonItems.ts\` rewrites \`items[]\` at render time. It is not a
formatter — it invents content:

- Every \`matchingExercise\` is treated as a **checkpoint**. Its \`items[].phrase\`
  values become "the terms introduced since the last checkpoint".
- Checkpoints alternate *light* / *full*, counted **backwards** from the last
  checkpoint in the lesson, so inserting one checkpoint reclassifies every
  earlier one.
- Each checkpoint emits a generated batch of \`matchAudioExercise\`, and full
  checkpoints additionally emit \`pronunciationExercise\` and
  \`dragAndDropExercise\` batches — none of which exist in the stored document.
- Hand-authored \`dragAndDropExercise\` / \`pronunciationExercise\` items are
  matched **by phrase** and substituted into the generated slot; any that are
  left over are silently **dropped** after the first checkpoint.
- Batches are \`shuffled()\` on **every call** — the rendered lesson is
  non-deterministic between two loads of the same document.

This is the central decision for the CMS. Either the expander is ported and
Payload stores the same sparse "seed" documents (authors keep an invisible
mental model), or expansion is run once as an import step and Payload stores
the fully-expanded, individually-editable exercise list. The second is far
more CMS-shaped, but it is a one-way door: shuffling and the backwards
light/full counting cannot be reconstructed afterwards.

### 2. Items resolve media from other items (blocking for flat blocks)

\`src/utils/termMedia.ts\` builds a lesson-wide registry keyed by a **fuzzy**
phrase match, and any item missing \`audioUrl\`/\`imageUrl\` inherits it from
whichever other item in the lesson mentions the same term. Blocks are
therefore **not independent** — a page's video can be the source of a drag &
drop's audio three items later. A naive per-block migration will produce
exercises with \`PLACEHOLDER_AUDIO_URL\` where the app currently shows real
media. Media should be normalised into a **Term/Vocabulary collection** and
referenced, rather than duplicated per block.

### 3. \`page\` is a kitchen-sink type — split it

\`page\` has 12 distinct optional fields and at least three disjoint sub-shapes:
a **video page** (\`videoUrl\` + \`videoForm\`), a **flashcard/terms page**
(\`format: "Flashcard"\` + \`terms[]\`), and a **grammar page**
(\`grammarPoints[]\`). \`format\` is free text, not an enum. Modelling this as one
Payload block yields a form where most fields are irrelevant. It should become
three blocks.

### 4. \`dragAndDropExercise\` has two disjoint shapes under one name

Only 7 of 24 stored instances carry \`correctSequence\` + \`options\` — i.e. the
actual puzzle. The other 17 carry only \`_term\` / \`audioUrl\` / \`imageUrl\` and
are media seeds for the expander, not exercises. Same \`type\`, different
meaning. Payload needs these separated, and the 17 probably belong in the term
registry (hazard 2) rather than as exercise blocks at all.

### 5. Ordering: \`number\` is unreliable — trust array position

\`number\` is present on only ~40% of items, and in \`l1-v2\` it is **not
monotonic** (\`8,9,10,11,10,…\`). It is a per-batch, per-section counter, not a
document-wide sequence, and the expander reassigns it anyway. Array order is
the real order. Do **not** import \`number\` as a sort key; let Payload's array
ordering own sequence and drop the field.

### 6. Parallel arrays coupled by index

- \`flashcards\` / \`flashcardsAudio\` on legacy lessons are index-parallel, and
  **9 of 11 lessons have audio missing entirely** (length 0 against 2–5 cards).
- \`connectTheDots\` / \`matchAudioLetter\` couple \`items\` to \`correctAnswers\` by
  value, and \`matchAudioLetter.correctAnswers\` is *always* length 1 — a single
  answer modelled as an array.

Both should become arrays of objects (\`{ card, audio? }\`,
\`{ label, isCorrect }\`) so the CMS cannot save a misaligned pair.

### 7. Placeholder sentinels are real stored content

\`PLACEHOLDER_AUDIO_URL\`, \`PLACEHOLDER_IMAGE_URL\`, \`PLACEHOLDER_VIDEO_URL\`,
\`PLACEHOLDER_TRANSLATION\` appear throughout the data (60+ in \`l2-v1\` alone).
These are unfilled authoring slots, not URLs. Importing them into a Payload
\`upload\` or URL field will either fail validation or produce broken media.
Import them as **empty**, and let required-field validation surface the gap.

### 8. Authoring notes stored as user-facing content

Several \`infoBreak\` / \`lifeUsefulFact\` bodies are briefs to the author rather
than lesson copy — e.g. \`"Topic: Consonant + vowel build. Format: Short
paragraph text bubble form."\` and \`"Trash sorting?"\`. One \`factBreak\` has
\`content: ""\` with a \`title\` of \`"Fun Fact"\`. This content needs an editorial
pass; a \`draft\`/\`published\` status on the block would make the unfinished
ones visible instead of shipping them.

### 9. No stable per-item identity in \`newlessons\`

Legacy exercises carry a human-meaningful \`exerciseId\` (\`l3_vocab_5_bonus\`).
\`newlessons\` items carry **no id at all** — they are addressed by array
position and by fuzzy phrase match. Any progress/attempt tracking keyed to an
exercise needs ids minted during import, and they must be stable across
re-imports or user progress detaches.

### 10. Field-naming inconsistencies to normalise on import

- \`audioURL\` (on \`page\`) vs \`audioUrl\` (everywhere else) — same concept.
- \`_term\` — underscore-prefixed, an internal expander key, but it is the only
  identifying field on 24/24 \`dragAndDropExercise\` items.
- Legacy \`title\` vs \`newlessons\` \`lesson\` for the display name (a known gap,
  already flagged in \`CLAUDE.md\`).
- \`matchingExercise.rows\` is free text describing UI layout
  (\`["audio buttons","image"]\`) — should be an enum, or dropped as presentation.
- \`vocabulary_drag_drop.prompt\` is \`null\` in 3 records and absent in 47 —
  null-vs-absent needs collapsing.

### 11. Code-supported fields with zero data

\`dragDropOptions\` (read on \`matchingExercise\`), and \`transcript\` / \`videoUrl\` /
\`phrase\` / \`checkpointPool\` on the synthesised exercise types, are all read by
the app but appear in **no stored document**. They are part of the real
authoring contract even though the audit's data-derived tables cannot see
them, and the Payload blocks should include them.

### 12. \`newTerms\` is present but always empty

\`newTerms\` appears on 20 of 29 \`page\` items and is length 0 in every single
case. It is a vestigial field the expander no longer depends on (terms come
from checkpoints instead). Drop it rather than carrying it into the CMS.
`;

async function main() {
  const { db, close } = await connectMongo();

  const mongoNew = new Profiler();
  const mongoLegacy = new Profiler();

  const mongoLessonFields = new Map<string, number>();
  const mongoNewLessonFields = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  const flashcardNotes: string[] = [];
  const orderNotes: string[] = [];

  try {
    const lessons = await db.collection("lessons").find({}).toArray();
    const newLessons = await db.collection("newlessons").find({}).toArray();

    for (const doc of lessons) {
      const slug = String(doc.slug ?? doc._id);
      for (const key of Object.keys(doc)) bump(mongoLessonFields, key);
      for (const ex of (Array.isArray(doc.exercises) ? doc.exercises : [])) {
        mongoLegacy.add(ex, slug);
      }
      const cards = Array.isArray(doc.flashcards) ? doc.flashcards : [];
      const audio = Array.isArray(doc.flashcardsAudio) ? doc.flashcardsAudio : [];
      flashcardNotes.push(
        `| mongo | \`${slug}\` | ${cards.length} | ${audio.length} | ${cards.length === audio.length ? "aligned" : "**MISALIGNED**"} | ${cell(cards[0])} / ${cell(audio[0])} |`
      );
    }

    for (const doc of newLessons) {
      const slug = String(doc.slug ?? doc._id);
      for (const key of Object.keys(doc)) bump(mongoNewLessonFields, key);
      const items = Array.isArray(doc.items) ? doc.items : [];
      items.forEach((item: unknown) => mongoNew.add(item, slug));

      // Order sensitivity: `number` is an author-facing sequence field that
      // may or may not track array position.
      const numbers = items.map((i: any) => i?.number);
      const hasNumbers = numbers.some((n) => n !== undefined);
      if (hasNumbers) {
        const monotonic = numbers.every(
          (n, i) => n === undefined || i === 0 || n === undefined || Number(n) >= Number(numbers[i - 1] ?? -Infinity)
        );
        orderNotes.push(
          `| \`${slug}\` | ${items.length} | ${numbers.filter((n) => n !== undefined).length} carry \`number\` | ${monotonic ? "non-decreasing" : "**not monotonic**"} | ${cell(numbers.slice(0, 12))} |`
        );
      }
    }

    /* ── output ─────────────────────────────────────────────────────── */

    console.log("# Mongo `items[]` shape audit (CMS handoff Task 0)\n");
    console.log(
      `Generated by \`scripts/migrate/04-items-audit.ts\` (read-only). ` +
        `Mongo database \`${db.databaseName}\`.\n`
    );

    console.log("## Store inventory\n");
    console.log("| store | collection/table | docs |");
    console.log("| --- | --- | --- |");
    console.log(`| mongo | \`lessons\` (legacy) | ${lessons.length} |`);
    console.log(`| mongo | \`newlessons\` (grammar) | ${newLessons.length} |`);

    console.log(
      "\n> **Mongo is the source of truth.** An earlier revision of this audit also read " +
        "Airtable, which held 9 legacy lessons against Mongo's 2, and concluded the import " +
        "had to source legacy lessons from there. #26 settled it the other way: Airtable is " +
        "retired and the 7 lessons unique to it were deliberately dropped. The import " +
        "(`01-content-to-payload.ts`) reads Mongo only.\n"
    );

    console.log("\n## Type inventory\n");
    const allTypes = new Map<string, { newl: number; legacy: number }>();
    const tally = (p: Profiler, key: "newl" | "legacy") => {
      for (const [name, stat] of p.types) {
        const row = allTypes.get(name) ?? { newl: 0, legacy: 0 };
        row[key] += stat.occurrences;
        allTypes.set(name, row);
      }
    };
    tally(mongoNew, "newl");
    tally(mongoLegacy, "legacy");

    console.log("| type | family | total occurrences | in code? |");
    console.log("| --- | --- | --- | --- |");
    const known = new Set([...TYPES_IN_CODE_NEWLESSONS, ...TYPES_IN_CODE_LEGACY]);
    for (const [name, row] of [...allTypes.entries()].sort(
      (a, b) => b[1].newl + b[1].legacy - (a[1].newl + a[1].legacy)
    )) {
      const family = row.newl && row.legacy ? "both" : row.newl ? "newlessons" : "legacy";
      console.log(
        `| \`${name}\` | ${family} | ${row.newl + row.legacy} | ${known.has(name) ? "yes" : "**NO — undocumented**"} |`
      );
    }

    console.log("\n### Declared in code but absent from stored data\n");
    const dead = [...known].filter((t) => !allTypes.has(t));
    console.log(dead.length ? dead.map((t) => `- \`${t}\``).join("\n") : "_None._");
    console.log(
      "\n**These are not dead.** `src/utils/expandLessonItems.ts` *synthesises* them at " +
        "render time — see the hazards section. They are never persisted in either store, " +
        "but the player shows them, so Payload still needs a vocabulary decision for them."
    );

    console.log("\n### Present in data but not named in code\n");
    const undocumented = [...allTypes.keys()].filter((t) => !known.has(t));
    console.log(
      undocumented.length ? undocumented.map((t) => `- \`${t}\``).join("\n") : "_None._"
    );

    console.log("\n---\n\n## Per-type field sets\n");
    renderProfiler("Mongo `newlessons` → `items[]`", mongoNew, "lessons");
    renderProfiler("Mongo `lessons` → `exercises[]`", mongoLegacy, "lessons");

    console.log("\n---\n\n## Flashcards / FlashcardsAudio pairing\n");
    console.log("| store | lesson | flashcards | audio | pairing | first card / first audio |");
    console.log("| --- | --- | --- | --- | --- | --- |");
    console.log(flashcardNotes.join("\n"));

    console.log("\n## `number` field and item ordering\n");
    if (orderNotes.length) {
      console.log("| lesson | items | numbered | sequence | first values |");
      console.log("| --- | --- | --- | --- | --- |");
      console.log(orderNotes.join("\n"));
    } else {
      console.log("_No item carries a `number` field._");
    }

    console.log("\n---\n\n## Contract gaps vs `src/lib/types/lessons.ts`\n");

    console.log("### Legacy `lessons` top-level fields\n");
    console.log("| field | docs with it | in contract? |");
    console.log("| --- | --- | --- |");
    for (const [key, n] of [...mongoLessonFields].sort()) {
      console.log(`| \`${key}\` | ${n}/${lessons.length} | ${CONTRACT_LESSON_FIELDS.has(key) ? "yes" : "**MISSING**"} |`);
    }

    console.log("\n### `newlessons` top-level fields\n");
    console.log("| field | docs with it | in contract? |");
    console.log("| --- | --- | --- |");
    for (const [key, n] of [...mongoNewLessonFields].sort()) {
      console.log(`| \`${key}\` | ${n}/${newLessons.length} | ${CONTRACT_NEWLESSON_FIELDS.has(key) ? "yes" : "**MISSING**"} |`);
    }

    console.log("\n### Legacy exercise fields absent from the `LessonExercise` union\n");
    const legacyFields = new Set(mongoLegacy.allFields());
    const missingLegacy = [...legacyFields].filter((f) => !CONTRACT_EXERCISE_FIELDS.has(f));
    console.log(
      missingLegacy.length ? missingLegacy.map((f) => `- \`${f}\``).join("\n") : "_None._"
    );

    console.log(
      "\n### `newlessons` item fields\n\n" +
        "`NewLessonItem` is `{ type: string; number?: number; [key: string]: unknown }` — " +
        "an index signature, so nothing here is strictly a *gap*, but nothing is typed either. " +
        "Full observed field vocabulary across all item types:\n"
    );
    const newFields = [...mongoNew.allFields()].sort();
    console.log(newFields.map((f) => `- \`${f}\``).join("\n"));
    console.log(
      "\n(Top-level only — nested sub-fields such as `terms[].term`, " +
        "`grammarPoints[].pattern`, and `matchingExercise.items[].englishTranslation` " +
        "are listed in the per-type nested-shape tables above.)"
    );

    console.log(HAZARDS);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
