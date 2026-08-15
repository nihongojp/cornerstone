import { config } from "dotenv";

/*
 * MongoDB → zod → Payload. The one-way content import (#19).
 *
 * Source is Mongo only. Airtable was retired in #26 and the content unique to
 * it was deliberately dropped, so there is no reconciliation step here.
 *
 * Three things make this more than a copy:
 *
 *  1. It runs the checkpoint expansion (#27). `expandLessonItems` used to
 *     synthesise matchAudio / pronunciation / dragAndDrop batches on every
 *     render; that synthesis happens exactly once, here, and the result
 *     becomes real editable content. The expansion is run with
 *     `identityShuffle` so it is a pure function of its input — running the
 *     import twice must not reorder anything. Shuffling is now a render-time
 *     concern, controlled by the lesson's `shuffleExercises` flag.
 *  2. It bakes media. The expansion resolves a term's audio/image/video from
 *     wherever else in the lesson it was entered (the `termMedia` registry);
 *     that resolution is written into each block, so blocks are independent
 *     and nothing is inherited at runtime.
 *  3. It drops placeholder sentinels. "PLACEHOLDER_AUDIO_URL" and friends
 *     import as *absent*, never as a fake URL, so the gaps are visible.
 *
 * Fail-loud by design: every record that cannot be imported is reported with
 * a reason and the process exits non-zero. The old Airtable adapter failed
 * soft and silently vanished malformed lessons; we are not repeating that.
 *
 * Idempotent: lessons and resource groups upsert on `sourceId` (the Mongo
 * `_id` hex), courses on `slug`. Re-running produces no duplicates and no
 * spurious diffs.
 *
 * Ends with a verification pass that re-reads everything through Payload,
 * maps it back to the `src/lib/types/lessons.ts` contract shapes, and diffs
 * it against the learner-visible sequence computed straight from Mongo. That
 * diff is the only proof the one-way expansion was done correctly.
 *
 * Run it with the project's own tsx ESM loader:
 *   node --import tsx/esm scripts/migrate/01-content-to-payload.ts
 * and note that this file loads `.env.local` itself before importing the
 * Payload config — the config reads PAYLOAD_SECRET at module scope and
 * Payload's CLI loadEnv does not cover script entrypoints.
 */

config({ path: ".env.local" });

import type { Payload } from "payload";

import {
  GrammarLessonSchema,
  LegacyLessonSchema,
  ResourceGroupSchema,
  classifyPage,
  cleanMediaUrl,
  isDragAndDropPuzzle,
  isPlaceholderUrl,
} from "../../src/lib/content/item-schemas";
import type { NewLessonItem } from "../../src/lib/types/lessons";
import { expandLessonItems, identityShuffle } from "../../src/utils/expandLessonItems";
import { connectMongo } from "./lib/mongo";

// ── Expected volume ───────────────────────────────────────────────────────────
// From the survey (#26, Mongo-only). A mismatch means the source moved under
// us: stop rather than import a partial set.

const EXPECTED = {
  legacyLessons: 2,
  grammarLessons: 3,
  resourceGroups: 8,
  exercisesBySlug: {
    "hiragana-l1-v1-hokkaido": 14,
    "hiragana-l2-v1-iwate": 9,
  } as Record<string, number>,
  itemsBySlug: { "l1-v1": 18, "l1-v2": 23, "l2-v1": 27 } as Record<string, number>,
};

// ── Course seed ───────────────────────────────────────────────────────────────
/*
 * ⚠️  ASSUMPTION — NOT YET CONFIRMED BY JUSTIN AND SACHI.
 *
 * Two courses, derived from the shape of the existing content: the two
 * hiragana/prefecture lessons form one track, the three grammar lessons
 * another (in the order the old `nextSlug` chain implied, l1-v1 → l1-v2, with
 * l2-v1 last). `nextSlug` itself is not stored — course + order replaces it.
 *
 * This is data on purpose. Changing the course set means editing this array
 * and re-running the import; nothing else keys off it. Courses upsert on
 * `slug`, and a lesson's course/order are overwritten on every run, so a
 * changed table takes effect immediately and cleanly.
 */
type CourseSeed = {
  slug: string;
  title: string;
  trackType: "beginner-to-intermediate" | "2-week-crash-course";
  description: string;
  /** Lesson slugs, in course order. Position in this array is `order`, 1-based. */
  lessonSlugs: string[];
};

const COURSE_SEED: CourseSeed[] = [
  {
    slug: "hiragana-and-prefectures",
    title: "Hiragana & prefectures",
    trackType: "beginner-to-intermediate",
    description: "Learn the hiragana syllabary one prefecture at a time.",
    lessonSlugs: ["hiragana-l1-v1-hokkaido", "hiragana-l2-v1-iwate"],
  },
  {
    slug: "grammar-and-conversation",
    title: "Grammar & conversation",
    trackType: "beginner-to-intermediate",
    description: "Greetings, everyday phrases, and the grammar that holds them together.",
    lessonSlugs: ["l1-v1", "l1-v2", "l2-v1"],
  },
];

// ── Reporting ─────────────────────────────────────────────────────────────────

type Report = {
  /** Records that could not be imported. Any entry here means exit 1. */
  rejected: Array<{ record: string; reason: string }>;
  /** Items routed to the `legacyJson` escape hatch. Loud, never silent. */
  legacyJson: Array<{ lesson: string; index: number; originalType: string }>;
  /** Source fields the content model deliberately does not carry. */
  droppedFields: Array<{ lesson: string; index: number; field: string; value: string }>;
  /** Placeholder sentinels turned into absent values. */
  placeholderDrops: Array<{ lesson: string; index: number; field: string }>;
  /** Resource links dropped outright — no id or no title, so nothing to carry. */
  droppedResourceLinks: Array<{ group: string; itemId: string; title: string }>;
  /** Imported, but with no URL yet — authoring notes awaiting a real link. */
  urlLessResourceLinks: Array<{ group: string; itemId: string; title: string }>;
};

const report: Report = {
  rejected: [],
  legacyJson: [],
  droppedFields: [],
  placeholderDrops: [],
  droppedResourceLinks: [],
  urlLessResourceLinks: [],
};

// ── Small helpers ─────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

const strArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.length ? v.map((x) => String(x)) : undefined;

/**
 * A media URL as it should be stored: real URLs pass through, placeholder
 * sentinels become `undefined` and are counted so the gap is reportable.
 */
function media(value: unknown, where: { lesson: string; index: number; field: string }): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const cleaned = cleanMediaUrl(value);
  if (cleaned === undefined) {
    report.placeholderDrops.push({ lesson: where.lesson, index: where.index, field: where.field });
  }
  return cleaned;
}

/**
 * Drops undefined/null/""/[] recursively and sorts object keys, so two shapes
 * compare on content alone. Array order is preserved — sequence is the whole
 * point of the verification pass.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    const out = value.map(canonical).filter((v) => v !== undefined);
    return out.length ? out : undefined;
  }
  if (value && typeof value === "object") {
    const out: Json = {};
    for (const k of Object.keys(value as Json).sort()) {
      const c = canonical((value as Json)[k]);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === undefined || value === "") return undefined;
  return value;
}

const canonicalJson = (value: unknown): string => JSON.stringify(canonical(value) ?? null);

// ── Grammar item → Payload block ──────────────────────────────────────────────

type Block = Json & { blockType: string };

/**
 * `checkpointPool` is the derived multiple-choice distractor list. It is a
 * pure function of the terms introduced earlier in the lesson, so it is
 * recomputed at render and never stored (#27).
 */
function stripDerived(item: NewLessonItem): NewLessonItem {
  const { checkpointPool: _drop, ...rest } = item as Json;
  return rest as NewLessonItem;
}

function noteDroppedField(lesson: string, index: number, field: string, value: unknown) {
  const s = str(value);
  if (s) report.droppedFields.push({ lesson, index, field, value: s });
}

function grammarBlock(item: NewLessonItem, lesson: string, index: number): Block {
  const any = item as Json;
  const type = String(any.type ?? "");
  const at = (field: string) => ({ lesson, index, field });

  switch (type) {
    case "page": {
      // `page` is three disjoint shapes wearing one type; classifyPage is the
      // discriminator the block model was built around.
      const variant = classifyPage(any as never);
      const prose = {
        description: str(any.description),
        content: str(any.content),
      };
      const title = str(any.title);
      if (!title) break; // title is required on every page block → escape hatch

      if (variant === "video") {
        return {
          blockType: "videoPage",
          title,
          videoUrl: media(any.videoUrl, at("videoUrl")),
          videoForm: strArray(any.videoForm),
          // Renamed: the source spells this `audioURL` on pages only. The
          // expansion may also have filled `audioUrl` from the term registry.
          audioUrl: media(any.audioUrl ?? any.audioURL, at("audioURL")),
          ...prose,
        };
      }
      if (variant === "terms") {
        return {
          blockType: "termsPage",
          title,
          format: str(any.format),
          terms: ((any.terms as Json[]) ?? []).map((t, ti) => ({
            term: String(t.term ?? ""),
            imageUrl: media(t.imageUrl, at(`terms[${ti}].imageUrl`)),
            audioUrl: media(t.audioUrl, at(`terms[${ti}].audioUrl`)),
          })),
          ...prose,
        };
      }
      if (variant === "grammar") {
        // `format` has no home on this block — it is modelled only on
        // termsPage. Reported rather than dropped quietly.
        noteDroppedField(lesson, index, "page.format", any.format);
        return {
          blockType: "grammarPage",
          title,
          grammarPoints: ((any.grammarPoints as Json[]) ?? []).map((g) => ({
            pattern: String(g.pattern ?? ""),
            examples: strArray(g.examples),
          })),
          ...prose,
        };
      }
      noteDroppedField(lesson, index, "page.format", any.format);
      return { blockType: "contentPage", title, ...prose };
    }

    case "matchingExercise": {
      const instructions = str(any.instructions);
      if (!instructions) break;
      return {
        blockType: "matchingExercise",
        instructions,
        items: ((any.items as Json[]) ?? []).map((m, mi) => ({
          phrase: String(m.phrase ?? ""),
          englishTranslation: str(m.englishTranslation),
          audioUrl: media(m.audioUrl, at(`items[${mi}].audioUrl`)),
          imageUrl: media(m.imageUrl, at(`items[${mi}].imageUrl`)),
        })),
        rows: strArray(any.rows),
        dragDropOptions: strArray(any.dragDropOptions),
        description: str(any.description),
      };
    }

    case "dragAndDropExercise": {
      const term = str(any._term);
      if (!term) break;
      // Two unrelated things share this type: a real puzzle and a media seed
      // that only ever existed to feed the old render-time generator.
      if (isDragAndDropPuzzle(any as never)) {
        return {
          blockType: "dragAndDropPuzzle",
          term, // `_term` → `term`: Payload reserves the underscore prefix
          correctSequence: strArray(any.correctSequence),
          options: strArray(any.options),
          audioUrl: media(any.audioUrl, at("audioUrl")),
          imageUrl: media(any.imageUrl, at("imageUrl")),
        };
      }
      return {
        blockType: "termMediaSeed",
        term,
        audioUrl: media(any.audioUrl, at("audioUrl")),
        imageUrl: media(any.imageUrl, at("imageUrl")),
      };
    }

    case "matchAudioExercise": {
      const phrase = str(any.phrase);
      if (!phrase) break;
      return {
        blockType: "matchAudioExercise",
        phrase,
        audioUrl: media(any.audioUrl, at("audioUrl")),
        imageUrl: media(any.imageUrl, at("imageUrl")),
      };
    }

    case "pronunciationExercise": {
      const phrase = str(any.phrase);
      if (!phrase) break;
      return {
        blockType: "pronunciationExercise",
        phrase,
        transcript: str(any.transcript),
        videoUrl: media(any.videoUrl, at("videoUrl")),
        audioUrl: media(any.audioUrl, at("audioUrl")),
      };
    }

    case "infoBreak":
    case "lifeUsefulFact": {
      const content = str(any.content);
      if (!content) break;
      return { blockType: type, content };
    }
  }

  report.legacyJson.push({ lesson, index, originalType: type || "(missing type)" });
  return { blockType: "legacyJson", originalType: type || "(missing type)", data: any };
}

// ── Legacy exercise → Payload block ───────────────────────────────────────────

function legacyBlock(ex: Json, lesson: string, index: number): Block {
  const type = String(ex.type ?? "");
  const exerciseId = str(ex.exerciseId);
  const at = (field: string) => ({ lesson, index, field });

  if (exerciseId) {
    switch (type) {
      case "connectTheDots":
        return {
          blockType: "connectTheDots",
          exerciseId,
          prompt: str(ex.prompt),
          items: strArray(ex.items),
          correctAnswers: strArray(ex.correctAnswers),
        };
      case "matchAudioLetter":
        return {
          blockType: "matchAudioLetter",
          exerciseId,
          prompt: str(ex.prompt),
          audioUrl: media(ex.audioUrl, at("audioUrl")),
          items: strArray(ex.items),
          correctAnswers: strArray(ex.correctAnswers),
        };
      case "vocabulary_drag_drop":
        return {
          blockType: "vocabularyDragDrop",
          exerciseId,
          prompt: str(ex.prompt),
          characterBank: strArray(ex.characterBank),
          correctAnswer: str(ex.correctAnswer),
          audioUrl: media(ex.audioUrl, at("audioUrl")),
          imageUrl: media(ex.imageUrl, at("imageUrl")),
          image: media(ex.image, at("image")),
          bonus: ex.bonus === true ? true : undefined,
        };
      case "factBreak":
        return {
          blockType: "factBreak",
          exerciseId,
          title: str(ex.title),
          content: str(ex.content),
          prompt: str(ex.prompt),
        };
    }
  }

  report.legacyJson.push({ lesson, index, originalType: type || "(missing type)" });
  return { blockType: "legacyJson", originalType: type || "(missing type)", data: ex };
}

/** A short, deterministic name for the admin list. Not shown to learners. */
function labelFor(block: Block): string | undefined {
  const b = block as Json;
  return (
    str(b.title) ?? str(b.term) ?? str(b.phrase) ?? str(b.exerciseId) ?? str(b.instructions) ?? undefined
  );
}

const asExercise = (block: Block) => ({ label: labelFor(block), components: [block] });

// ── Payload block → the contract shapes (verification only) ───────────────────
/*
 * Deliberately written as an independent reverse mapper rather than reusing
 * anything above, so the verification pass can actually catch a mistake in the
 * forward mapping instead of agreeing with it.
 */

function blockToItem(block: Json): NewLessonItem {
  const t = String(block.blockType ?? "");
  switch (t) {
    case "videoPage":
      return {
        type: "page",
        title: block.title,
        videoUrl: block.videoUrl,
        videoForm: block.videoForm,
        audioUrl: block.audioUrl,
        description: block.description,
        content: block.content,
      } as NewLessonItem;
    case "termsPage":
      return {
        type: "page",
        title: block.title,
        format: block.format,
        terms: ((block.terms as Json[]) ?? []).map((t2) => ({
          term: t2.term,
          imageUrl: t2.imageUrl,
          audioUrl: t2.audioUrl,
        })),
        description: block.description,
        content: block.content,
      } as NewLessonItem;
    case "grammarPage":
      return {
        type: "page",
        title: block.title,
        grammarPoints: ((block.grammarPoints as Json[]) ?? []).map((g) => ({
          pattern: g.pattern,
          examples: g.examples,
        })),
        description: block.description,
        content: block.content,
      } as NewLessonItem;
    case "contentPage":
      return {
        type: "page",
        title: block.title,
        description: block.description,
        content: block.content,
      } as NewLessonItem;
    case "matchingExercise":
      return {
        type: "matchingExercise",
        instructions: block.instructions,
        items: ((block.items as Json[]) ?? []).map((m) => ({
          phrase: m.phrase,
          englishTranslation: m.englishTranslation,
          audioUrl: m.audioUrl,
          imageUrl: m.imageUrl,
        })),
        rows: block.rows,
        dragDropOptions: block.dragDropOptions,
        description: block.description,
      } as NewLessonItem;
    case "dragAndDropPuzzle":
      return {
        type: "dragAndDropExercise",
        _term: block.term,
        correctSequence: block.correctSequence,
        options: block.options,
        audioUrl: block.audioUrl,
        imageUrl: block.imageUrl,
      } as NewLessonItem;
    case "termMediaSeed":
      return {
        type: "dragAndDropExercise",
        _term: block.term,
        audioUrl: block.audioUrl,
        imageUrl: block.imageUrl,
      } as NewLessonItem;
    case "matchAudioExercise":
      return {
        type: "matchAudioExercise",
        phrase: block.phrase,
        audioUrl: block.audioUrl,
        imageUrl: block.imageUrl,
      } as NewLessonItem;
    case "pronunciationExercise":
      return {
        type: "pronunciationExercise",
        phrase: block.phrase,
        transcript: block.transcript,
        videoUrl: block.videoUrl,
        audioUrl: block.audioUrl,
      } as NewLessonItem;
    case "infoBreak":
    case "lifeUsefulFact":
      return { type: t, content: block.content } as NewLessonItem;
    default:
      return { type: `legacyJson:${String(block.originalType ?? "?")}` } as NewLessonItem;
  }
}

function blockToLegacyExercise(block: Json): Json {
  const t = String(block.blockType ?? "");
  switch (t) {
    case "connectTheDots":
      return {
        type: "connectTheDots",
        exerciseId: block.exerciseId,
        items: block.items,
        correctAnswers: block.correctAnswers,
        prompt: block.prompt,
      };
    case "matchAudioLetter":
      return {
        type: "matchAudioLetter",
        exerciseId: block.exerciseId,
        items: block.items,
        correctAnswers: block.correctAnswers,
        audioUrl: block.audioUrl,
        prompt: block.prompt,
      };
    case "vocabularyDragDrop":
      return {
        type: "vocabulary_drag_drop",
        exerciseId: block.exerciseId,
        characterBank: block.characterBank,
        correctAnswer: block.correctAnswer,
        prompt: block.prompt,
        audioUrl: block.audioUrl,
        imageUrl: block.imageUrl,
        image: block.image,
        bonus: block.bonus === true ? true : undefined,
      };
    case "factBreak":
      return {
        type: "factBreak",
        exerciseId: block.exerciseId,
        title: block.title,
        content: block.content,
        prompt: block.prompt,
      };
    case "flashcardDeck":
      return {
        type: "flashcardDeck",
        cards: ((block.cards as Json[]) ?? []).map((c) => ({ card: c.card, audioUrl: c.audioUrl })),
      };
    default:
      return { type: `legacyJson:${String(block.originalType ?? "?")}` };
  }
}

// ── The expected learner-visible sequence, computed from raw Mongo ────────────
/*
 * The other half of the acceptance test. Same expansion, same media baking,
 * same placeholder dropping — but projected straight from the Mongo document
 * to the contract shape, never touching Payload.
 */

function expandForCompare(rawItems: NewLessonItem[]): NewLessonItem[] {
  return expandLessonItems(rawItems, { shuffle: identityShuffle }).map(stripDerived);
}

function expectedGrammarSequence(rawItems: NewLessonItem[]): NewLessonItem[] {
  return expandForCompare(rawItems).map((item) => {
    const any = item as Json;
    const type = String(any.type ?? "");
    const clean = (v: unknown) => cleanMediaUrl(v);

    if (type === "page") {
      const variant = classifyPage(any as never);
      const base = { type: "page", title: any.title, description: any.description, content: any.content };
      if (variant === "video") {
        return {
          ...base,
          videoUrl: clean(any.videoUrl),
          videoForm: any.videoForm,
          audioUrl: clean(any.audioUrl ?? any.audioURL),
        } as NewLessonItem;
      }
      if (variant === "terms") {
        return {
          ...base,
          format: any.format,
          terms: ((any.terms as Json[]) ?? []).map((t) => ({
            term: t.term,
            imageUrl: clean(t.imageUrl),
            audioUrl: clean(t.audioUrl),
          })),
        } as NewLessonItem;
      }
      if (variant === "grammar") {
        return {
          ...base,
          grammarPoints: ((any.grammarPoints as Json[]) ?? []).map((g) => ({
            pattern: g.pattern,
            examples: g.examples,
          })),
        } as NewLessonItem;
      }
      return base as NewLessonItem;
    }

    if (type === "matchingExercise") {
      return {
        type,
        instructions: any.instructions,
        items: ((any.items as Json[]) ?? []).map((m) => ({
          phrase: m.phrase,
          englishTranslation: m.englishTranslation,
          audioUrl: clean(m.audioUrl),
          imageUrl: clean(m.imageUrl),
        })),
        rows: any.rows,
        dragDropOptions: any.dragDropOptions,
        description: any.description,
      } as NewLessonItem;
    }

    if (type === "dragAndDropExercise") {
      const puzzle = isDragAndDropPuzzle(any as never);
      return {
        type,
        _term: any._term,
        ...(puzzle ? { correctSequence: any.correctSequence, options: any.options } : {}),
        audioUrl: clean(any.audioUrl),
        imageUrl: clean(any.imageUrl),
      } as NewLessonItem;
    }

    if (type === "matchAudioExercise") {
      return {
        type,
        phrase: any.phrase,
        audioUrl: clean(any.audioUrl),
        imageUrl: clean(any.imageUrl),
      } as NewLessonItem;
    }

    if (type === "pronunciationExercise") {
      return {
        type,
        phrase: any.phrase,
        transcript: any.transcript,
        videoUrl: clean(any.videoUrl),
        audioUrl: clean(any.audioUrl),
      } as NewLessonItem;
    }

    if (type === "infoBreak" || type === "lifeUsefulFact") {
      return { type, content: any.content } as NewLessonItem;
    }

    return { type: `legacyJson:${type}` } as NewLessonItem;
  });
}

function expectedLegacySequence(doc: Json): Json[] {
  const cards = ((doc.flashcards as string[]) ?? []).map((card, i) => ({
    card,
    audioUrl: cleanMediaUrl(((doc.flashcardsAudio as string[]) ?? [])[i]),
  }));
  const out: Json[] = [];
  if (cards.length) out.push({ type: "flashcardDeck", cards });
  for (const ex of ((doc.exercises as Json[]) ?? [])) {
    const t = String(ex.type ?? "");
    const clean = (v: unknown) => cleanMediaUrl(v);
    if (t === "connectTheDots") {
      out.push({ type: t, exerciseId: ex.exerciseId, items: ex.items, correctAnswers: ex.correctAnswers, prompt: ex.prompt });
    } else if (t === "matchAudioLetter") {
      out.push({
        type: t,
        exerciseId: ex.exerciseId,
        items: ex.items,
        correctAnswers: ex.correctAnswers,
        audioUrl: clean(ex.audioUrl),
        prompt: ex.prompt,
      });
    } else if (t === "vocabulary_drag_drop") {
      out.push({
        type: t,
        exerciseId: ex.exerciseId,
        characterBank: ex.characterBank,
        correctAnswer: ex.correctAnswer,
        prompt: ex.prompt,
        audioUrl: clean(ex.audioUrl),
        imageUrl: clean(ex.imageUrl),
        image: clean(ex.image),
        bonus: ex.bonus === true ? true : undefined,
      });
    } else if (t === "factBreak") {
      out.push({ type: t, exerciseId: ex.exerciseId, title: ex.title, content: ex.content, prompt: ex.prompt });
    } else {
      out.push({ type: `legacyJson:${t}` });
    }
  }
  return out;
}

// ── Upsert ────────────────────────────────────────────────────────────────────

async function upsertBy(
  payload: Payload,
  collection: "lessons" | "resources" | "courses",
  key: "sourceId" | "slug",
  value: string,
  data: Json
): Promise<number> {
  const found = await payload.find({
    collection,
    where: { [key]: { equals: value } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });

  if (found.docs.length) {
    const id = found.docs[0].id;
    // No `draft` flag: required-field validation must run, and the published
    // row is what the read path serves.
    await payload.update({ collection, id, data: data as never, depth: 0, overrideAccess: true });
    return id as number;
  }
  const created = await payload.create({ collection, data: data as never, depth: 0, overrideAccess: true });
  return created.id as number;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { db, close } = await connectMongo();
  console.log(`\nImporting from MongoDB "${db.databaseName}" → Payload\n`);

  if (db.databaseName !== "Cornerstone") {
    throw new Error(
      `MONGODB_URI points at database "${db.databaseName}", expected "Cornerstone". ` +
        "The database name has to be in the URI."
    );
  }

  const legacyDocs = await db.collection("lessons").find({}).sort({ slug: 1 }).toArray();
  const grammarDocs = await db.collection("newlessons").find({}).sort({ slug: 1 }).toArray();
  // Capitalised on purpose — that is the live collection name.
  const resourceDocs = await db.collection("Resource").find({}).sort({ _id: 1 }).toArray();
  await close();

  // ── Volume gate ─────────────────────────────────────────────────────────────
  const volumeProblems: string[] = [];
  const expectCount = (label: string, actual: number, expected: number) => {
    console.log(`  ${label}: ${actual} (expected ${expected})`);
    if (actual !== expected) volumeProblems.push(`${label}: found ${actual}, expected ${expected}`);
  };
  console.log("Source volume");
  expectCount("legacy lessons", legacyDocs.length, EXPECTED.legacyLessons);
  expectCount("grammar lessons", grammarDocs.length, EXPECTED.grammarLessons);
  expectCount("resource groups", resourceDocs.length, EXPECTED.resourceGroups);
  for (const [slug, n] of Object.entries(EXPECTED.exercisesBySlug)) {
    const doc = legacyDocs.find((d) => d.slug === slug);
    expectCount(`  ${slug} exercises`, ((doc?.exercises as unknown[]) ?? []).length, n);
  }
  for (const [slug, n] of Object.entries(EXPECTED.itemsBySlug)) {
    const doc = grammarDocs.find((d) => d.slug === slug);
    expectCount(`  ${slug} items`, ((doc?.items as unknown[]) ?? []).length, n);
  }
  if (volumeProblems.length) {
    console.error("\n✗ Source volume does not match the survey — refusing to import a partial set:");
    for (const p of volumeProblems) console.error(`    ${p}`);
    process.exit(1);
  }

  // ── Validate everything before writing anything ─────────────────────────────
  const legacy: Array<{ id: string; doc: Json }> = [];
  for (const doc of legacyDocs) {
    const parsed = LegacyLessonSchema.safeParse(doc);
    if (!parsed.success) {
      report.rejected.push({
        record: `lessons/${doc.slug ?? doc._id}`,
        reason: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
      });
      continue;
    }
    legacy.push({ id: String(doc._id), doc: doc as Json });
  }

  const grammar: Array<{ id: string; doc: Json }> = [];
  for (const doc of grammarDocs) {
    const parsed = GrammarLessonSchema.safeParse(doc);
    if (!parsed.success) {
      report.rejected.push({
        record: `newlessons/${doc.slug ?? doc._id}`,
        reason: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
      });
      continue;
    }
    grammar.push({ id: String(doc._id), doc: doc as Json });
  }

  const resources: Array<{ id: string; doc: Json }> = [];
  for (const doc of resourceDocs) {
    const parsed = ResourceGroupSchema.safeParse(doc);
    if (!parsed.success) {
      report.rejected.push({
        record: `Resource/${doc.category ?? doc._id}`,
        reason: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
      });
      continue;
    }
    resources.push({ id: String(doc._id), doc: doc as Json });
  }

  if (report.rejected.length) {
    console.error("\n✗ Source records failed zod validation — nothing was written:");
    for (const r of report.rejected) console.error(`    ${r.record}\n      ${r.reason}`);
    process.exit(1);
  }
  console.log("\n✓ every source record validates against the zod schemas");

  // ── Payload ─────────────────────────────────────────────────────────────────
  // Imported after dotenv above: the config reads PAYLOAD_SECRET at module scope.
  const { getPayload } = await import("payload");
  const { default: payloadConfig } = await import("../../src/payload.config");
  const payload = await getPayload({ config: payloadConfig });

  // Courses first — lessons need their ids.
  console.log("\nCourses (⚠️  the course set is an ASSUMPTION — awaiting Justin and Sachi)");
  const courseIdBySlug = new Map<string, number>();
  for (const course of COURSE_SEED) {
    const id = await upsertBy(payload, "courses", "slug", course.slug, {
      title: course.title,
      slug: course.slug,
      trackType: course.trackType,
      description: course.description,
      _status: "published",
    });
    courseIdBySlug.set(course.slug, id);
    console.log(`  ✓ ${course.slug} — ${course.lessonSlugs.join(", ")}`);
  }

  const placement = new Map<string, { courseId: number; order: number }>();
  for (const course of COURSE_SEED) {
    course.lessonSlugs.forEach((slug, i) => {
      placement.set(slug, { courseId: courseIdBySlug.get(course.slug)!, order: i + 1 });
    });
  }

  // ── Legacy lessons ──────────────────────────────────────────────────────────
  console.log("\nLegacy lessons");
  const blockCounts: Record<string, number> = {};
  const countBlock = (b: Block) => {
    blockCounts[b.blockType] = (blockCounts[b.blockType] ?? 0) + 1;
  };

  for (const { id, doc } of legacy) {
    const slug = String(doc.slug);
    const exercises: Array<{ label?: string; components: Block[] }> = [];

    const cards = ((doc.flashcards as string[]) ?? []).map((card, i) => ({
      card,
      audioUrl: media(((doc.flashcardsAudio as string[]) ?? [])[i], {
        lesson: slug,
        index: -1,
        field: `flashcardsAudio[${i}]`,
      }),
    }));
    if (cards.length) {
      const deck: Block = { blockType: "flashcardDeck", title: "Flashcards", cards };
      countBlock(deck);
      exercises.push({ label: "Flashcards", components: [deck] });
    }

    ((doc.exercises as Json[]) ?? []).forEach((ex, i) => {
      const block = legacyBlock(ex, slug, i);
      countBlock(block);
      exercises.push(asExercise(block));
    });

    const place = placement.get(slug);
    const achievement = doc.achievement as Json | undefined;
    await upsertBy(payload, "lessons", "sourceId", id, {
      title: String(doc.title ?? slug),
      slug,
      course: place?.courseId,
      order: place?.order,
      cardTitle: str(doc.cardTitle),
      // Legacy lessons have no generated batches, so there is nothing to
      // shuffle — and their exercise order is authored.
      shuffleExercises: false,
      exercises,
      prefecture: str(doc.prefecture),
      tags: strArray(doc.tags) ?? [],
      version: str(doc.version),
      funFact: str(doc.funFact),
      notes: str(doc.notes),
      achievement: achievement ? { title: str(achievement.title), xp: achievement.xp } : undefined,
      sourceId: id,
      _status: "published",
    });
    console.log(`  ✓ ${slug} — ${exercises.length} exercises`);
  }

  // ── Grammar lessons (expanded) ──────────────────────────────────────────────
  console.log("\nGrammar lessons (expanded — #27)");
  const expandedBySlug = new Map<string, NewLessonItem[]>();

  for (const { id, doc } of grammar) {
    const slug = String(doc.slug);
    const rawItems = (doc.items as NewLessonItem[]) ?? [];
    const expanded = expandForCompare(rawItems);
    expandedBySlug.set(slug, expanded);

    const exercises = expanded.map((item, i) => {
      const block = grammarBlock(item, slug, i);
      countBlock(block);
      return asExercise(block);
    });

    const place = placement.get(slug);
    await upsertBy(payload, "lessons", "sourceId", id, {
      // `lesson` → `title`: the two Mongo collections never normalised this.
      title: String(doc.lesson ?? slug),
      slug,
      course: place?.courseId,
      order: place?.order,
      cardTitle: str(doc.cardTitle),
      // The expansion was baked in source order; shuffling generated groups
      // is now the player's job.
      shuffleExercises: true,
      exercises,
      tags: strArray(doc.tags) ?? [],
      sourceId: id,
      _status: "published",
      // `nextSlug` is deliberately not stored — course + order replaces it.
    });
    console.log(
      `  ✓ ${slug} — ${rawItems.length} source items → ${exercises.length} exercises` +
        (doc.nextSlug ? `  (nextSlug "${String(doc.nextSlug)}" dropped → course order)` : "")
    );
  }

  // ── Resources ───────────────────────────────────────────────────────────────
  console.log("\nResource groups");
  for (const { id, doc } of resources) {
    const category = String(doc.category ?? "");
    const items: Json[] = [];
    for (const raw of ((doc.items as Json[]) ?? [])) {
      const item = raw ?? {};
      const url = str(item.url);
      const itemId = str(item.id) ?? str(item.itemId);
      const title = str(item.title);
      if (!itemId || !title) {
        // No id or no title means there is nothing to carry across. A missing
        // *url* is fine — see below.
        report.droppedResourceLinks.push({
          group: category,
          itemId: itemId ?? "(no id)",
          title: title ?? "(no title)",
        });
        continue;
      }
      // A link with no URL still imports. `url` is optional on the block
      // because the site already renders these as "(No URL)", and the title +
      // description are the authoring note someone will replace with the real
      // resource — losing them would mean recovering them from a Mongo dump.
      if (!url) {
        report.urlLessResourceLinks.push({ group: category, itemId, title });
      }
      items.push({ itemId, title, url, description: str(item.description) });
    }
    await upsertBy(payload, "resources", "sourceId", id, {
      category,
      items,
      sourceId: id,
      _status: "published",
    });
    console.log(`  ✓ ${category} — ${items.length} links`);
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log("\nBlocks written, by type");
  for (const [type, n] of Object.entries(blockCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${type}`);
  }
  const totalBlocks = Object.values(blockCounts).reduce((a, b) => a + b, 0);
  console.log(`  ${String(totalBlocks).padStart(3)}  TOTAL`);

  console.log(`\nPlaceholder media URLs dropped: ${report.placeholderDrops.length}`);
  const byLesson: Record<string, number> = {};
  for (const p of report.placeholderDrops) byLesson[p.lesson] = (byLesson[p.lesson] ?? 0) + 1;
  for (const [lesson, n] of Object.entries(byLesson)) console.log(`  ${String(n).padStart(3)}  ${lesson}`);

  if (report.droppedFields.length) {
    console.log(`\n⚠️  Source fields with no home in the content model: ${report.droppedFields.length}`);
    for (const d of report.droppedFields) {
      console.log(`  ${d.lesson}[${d.index}] ${d.field} = ${JSON.stringify(d.value)}`);
    }
  }

  if (report.urlLessResourceLinks.length) {
    console.log(
      `\n📝 Resource links imported without a URL (kept as authoring notes): ${report.urlLessResourceLinks.length}`
    );
    for (const d of report.urlLessResourceLinks) console.log(`  ${d.group} / ${d.itemId} — ${d.title}`);
  }

  if (report.droppedResourceLinks.length) {
    console.log(`\n⚠️  Resource links skipped (no id or title): ${report.droppedResourceLinks.length}`);
    for (const d of report.droppedResourceLinks) console.log(`  ${d.group} / ${d.itemId} — ${d.title}`);
  }

  if (report.legacyJson.length) {
    console.log(`\n⚠️  Routed to the legacyJson escape hatch: ${report.legacyJson.length}`);
    for (const l of report.legacyJson) console.log(`  ${l.lesson}[${l.index}] type=${l.originalType}`);
  } else {
    console.log("\n✓ nothing routed to legacyJson — every item mapped to a real block");
  }

  // ── Verification pass (the #27 acceptance test) ──────────────────────────────
  console.log("\n" + "─".repeat(72));
  console.log("Verification: Payload → contract shapes, diffed against Mongo\n");

  let diffs = 0;
  const diff = (label: string, expected: unknown, actual: unknown) => {
    if (canonicalJson(expected) === canonicalJson(actual)) return true;
    diffs++;
    console.log(`  ✗ ${label}`);
    console.log(`      expected: ${canonicalJson(expected).slice(0, 400)}`);
    console.log(`      actual:   ${canonicalJson(actual).slice(0, 400)}`);
    return false;
  };

  const stored = await payload.find({
    collection: "lessons",
    limit: 0,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });
  const storedBySourceId = new Map(stored.docs.map((d) => [String(d.sourceId), d as unknown as Json]));

  for (const { id, doc } of grammar) {
    const slug = String(doc.slug);
    const row = storedBySourceId.get(id);
    if (!row) {
      diffs++;
      console.log(`  ✗ ${slug}: not found in Payload`);
      continue;
    }
    const actual = ((row.exercises as Json[]) ?? []).map((ex) => blockToItem(((ex.components as Json[]) ?? [])[0] ?? {}));
    const expected = expectedGrammarSequence((doc.items as NewLessonItem[]) ?? []);

    let ok = diff(`${slug}: sequence length`, expected.length, actual.length);
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
      const stepOk = diff(`${slug}[${i}] (${String((expected[i] as Json)?.type ?? "-")})`, expected[i], actual[i]);
      ok = ok && stepOk;
    }
    if (ok) console.log(`  ✓ ${slug} — ${expected.length} exercises match, in order`);
  }

  for (const { id, doc } of legacy) {
    const slug = String(doc.slug);
    const row = storedBySourceId.get(id);
    if (!row) {
      diffs++;
      console.log(`  ✗ ${slug}: not found in Payload`);
      continue;
    }
    const actual = ((row.exercises as Json[]) ?? []).map((ex) =>
      blockToLegacyExercise(((ex.components as Json[]) ?? [])[0] ?? {})
    );
    const expected = expectedLegacySequence(doc);

    let ok = diff(`${slug}: sequence length`, expected.length, actual.length);
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
      const stepOk = diff(`${slug}[${i}] (${String(expected[i]?.type ?? "-")})`, expected[i], actual[i]);
      ok = ok && stepOk;
    }
    // Lesson-level metadata the players read.
    ok = diff(`${slug}: title`, doc.title, row.title) && ok;
    ok = diff(`${slug}: prefecture`, doc.prefecture, row.prefecture) && ok;
    ok = diff(`${slug}: funFact`, doc.funFact, row.funFact) && ok;
    if (ok) console.log(`  ✓ ${slug} — ${expected.length} exercises match, in order`);
  }

  // Course placement replaces the old nextSlug chain.
  for (const course of COURSE_SEED) {
    course.lessonSlugs.forEach((slug, i) => {
      const row = [...storedBySourceId.values()].find((d) => d.slug === slug);
      diff(`course ${course.slug}: ${slug} order`, i + 1, row?.order);
    });
  }

  console.log(
    diffs === 0
      ? "\n✓ VERIFICATION PASSED — the stored content reproduces the learner-visible\n" +
          "  sequence computed from Mongo exactly (same exercises, same order).\n"
      : `\n✗ VERIFICATION FAILED — ${diffs} difference(s)\n`
  );

  // ── Final counts ────────────────────────────────────────────────────────────
  const [courses, lessons, resourcesOut] = await Promise.all([
    payload.count({ collection: "courses", overrideAccess: true }),
    payload.count({ collection: "lessons", overrideAccess: true }),
    payload.count({ collection: "resources", overrideAccess: true }),
  ]);
  const exerciseTotal = stored.docs.reduce(
    (n, d) => n + (((d as unknown as Json).exercises as Json[]) ?? []).length,
    0
  );
  console.log("Final content in Payload");
  console.log(`  courses:   ${courses.totalDocs}`);
  console.log(`  lessons:   ${lessons.totalDocs}`);
  console.log(`  resources: ${resourcesOut.totalDocs}`);
  console.log(`  exercises: ${exerciseTotal}`);
  console.log(`  blocks:    ${totalBlocks}\n`);

  const failed = diffs > 0 || report.rejected.length > 0;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("\n✗ import failed\n", err);
  process.exit(1);
});
