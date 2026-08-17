import { z } from "zod";

/*
 * The canonical description of lesson content.
 *
 * These schemas are the durable artifact of the content migration: they
 * outlive the storage engine. Mongo (the import source), the Payload
 * collections that replace it, and the players that consume the result all
 * have to agree, and this file is where that agreement is written down.
 *
 * Derived from a survey of the real data (`scripts/migrate/out/items-audit.md`)
 * reconciled against the TS contract in `../types/lessons.ts`. Where the data
 * and the contract disagreed, the data won and the difference is noted.
 *
 * Two things deliberately absent, both decided in issue #27:
 *
 *  - `checkpointPool` — the multiple-choice distractor pool. It is a pure
 *    function of "which terms appear before this exercise", so it is computed
 *    at render, never stored. Materialising it would copy a growing list into
 *    every exercise and go stale on the first edit.
 *  - placeholder sentinels — the source data stores literal
 *    "PLACEHOLDER_AUDIO_URL" strings where media is missing. These validate
 *    fine as strings here; the import is responsible for turning them into
 *    absent values via `isPlaceholderUrl` so the gaps become visible.
 *
 * Exercise types that the old renderer synthesised on the fly
 * (`matchAudioExercise`, `pronunciationExercise`) are first-class here even
 * though they appear in zero stored documents today — as of #27 the import
 * materialises them once, and from then on they are real, editable content.
 */

// ── Shared ────────────────────────────────────────────────────────────────────

/**
 * A media URL as *stored*. Kept permissive on purpose: the source data holds a
 * mix of real Cloudinary URLs and placeholder sentinels, and rejecting the
 * latter here would fail the import on content that is merely incomplete.
 * Use `isPlaceholderUrl` to tell them apart.
 */
export const MediaUrlSchema = z.string();

/**
 * True for the placeholder sentinels the old Compass authoring flow left
 * behind ("PLACEHOLDER_AUDIO_URL", "PLACEHOLDER_IMAGE_URL", ...). 60+ of these
 * exist in `l2-v1` alone. The import drops them rather than carrying a fake
 * URL into a real media field.
 */
export function isPlaceholderUrl(value: unknown): boolean {
  return (
    typeof value !== "string" || value.trim() === "" || value.toUpperCase().includes("PLACEHOLDER")
  );
}

/** Drops a value that is really an "unset" sentinel. */
export function cleanMediaUrl(value: unknown): string | undefined {
  return isPlaceholderUrl(value) ? undefined : (value as string);
}

/*
 * `number` is present on only ~40% of items and is non-monotonic in `l1-v2`
 * (…8, 9, 10, 11, 10…). Array position is the real ordering. Accepted so
 * existing documents validate; the import must not trust it.
 */
const LooseOrdinal = z.number().optional();

// ── Grammar-lesson components (the `newlessons` items[] family) ───────────────

/**
 * `page` is a kitchen sink: three disjoint shapes (a video page, a
 * flashcard-terms page, and a grammar page) share one type, and `format` is
 * free text rather than an enum. Modelled faithfully here — splitting it into
 * three Payload blocks is the collection-modelling ticket's job, and
 * `classifyPage` below is what that split should key on.
 */
export const PageTermSchema = z.object({
  term: z.string(),
  imageUrl: MediaUrlSchema.optional(),
  audioUrl: MediaUrlSchema.optional(),
});

export const GrammarPointSchema = z.object({
  pattern: z.string(),
  examples: z.array(z.string()),
});

export const PageSchema = z.object({
  type: z.literal("page"),
  number: LooseOrdinal,
  title: z.string(),
  // video shape
  videoUrl: MediaUrlSchema.optional(),
  videoForm: z.array(z.string()).optional(),
  /** Note the casing: `audioURL` here, `audioUrl` on every other type. */
  audioURL: MediaUrlSchema.optional(),
  // flashcard-terms shape
  terms: z.array(PageTermSchema).optional(),
  /** Free text in the data ("Flashcard", …), not an enum. */
  format: z.string().optional(),
  // grammar shape
  grammarPoints: z.array(GrammarPointSchema).optional(),
  // common
  description: z.string().optional(),
  content: z.string().optional(),
  /** Always an empty array in the observed data — vestigial. */
  newTerms: z.array(z.unknown()).optional(),
});

export type PageVariant = "video" | "terms" | "grammar" | "bare";

/** Which of the three real shapes a `page` actually is. */
export function classifyPage(page: z.infer<typeof PageSchema>): PageVariant {
  if (page.grammarPoints?.length) return "grammar";
  if (page.terms?.length) return "terms";
  if (page.videoUrl || page.videoForm?.length) return "video";
  return "bare";
}

/**
 * A checkpoint. Its `items[].phrase` values are the terms introduced since the
 * previous checkpoint — which is why it drove exercise generation in the old
 * renderer. Post-#27 it is just an exercise; the generation happened once, at
 * import.
 */
export const MatchingExerciseItemSchema = z.object({
  phrase: z.string(),
  audioUrl: MediaUrlSchema.optional(),
  imageUrl: MediaUrlSchema.optional(),
  englishTranslation: z.string().optional(),
});

export const MatchingExerciseSchema = z.object({
  type: z.literal("matchingExercise"),
  number: LooseOrdinal,
  instructions: z.string(),
  items: z.array(MatchingExerciseItemSchema),
  /** Free-text layout hints, e.g. ["audio buttons", "image"]. */
  rows: z.array(z.string()).optional(),
  description: z.string().optional(),
  /** Author-curated distractor pool, overriding the derived one. */
  dragDropOptions: z.array(z.string()).optional(),
});

/**
 * Two disjoint things share this name: a real puzzle (has `correctSequence`
 * and `options`) and a media seed that existed only to feed the old generator
 * (has neither). Only 7 of 24 observed were real puzzles. Kept as one schema
 * so existing documents validate; use `isDragAndDropPuzzle` to tell them
 * apart, and expect the collection model to split them.
 */
export const DragAndDropExerciseSchema = z.object({
  type: z.literal("dragAndDropExercise"),
  number: LooseOrdinal,
  /** The term this exercise is about — the only identifying field it has. */
  _term: z.string(),
  audioUrl: MediaUrlSchema.optional(),
  imageUrl: MediaUrlSchema.optional(),
  correctSequence: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
});

export function isDragAndDropPuzzle(item: z.infer<typeof DragAndDropExerciseSchema>): boolean {
  return Boolean(item.correctSequence?.length && item.options?.length);
}

/**
 * Materialised by the import (#27); never present in the source data. The old
 * renderer generated one per term at every checkpoint.
 */
export const MatchAudioExerciseSchema = z.object({
  type: z.literal("matchAudioExercise"),
  number: LooseOrdinal,
  phrase: z.string(),
  audioUrl: MediaUrlSchema.optional(),
  imageUrl: MediaUrlSchema.optional(),
});

/**
 * Also materialised by the import. `audioUrl` is dedicated reference audio for
 * scoring — deliberately not the video's audio track. This is the only content
 * the pronunciation service can grade against.
 */
export const PronunciationExerciseSchema = z.object({
  type: z.literal("pronunciationExercise"),
  number: LooseOrdinal,
  phrase: z.string(),
  /** Longer display text; falls back to `phrase` in the UI when absent. */
  transcript: z.string().optional(),
  videoUrl: MediaUrlSchema.optional(),
  audioUrl: MediaUrlSchema.optional(),
});

export const InfoBreakSchema = z.object({
  type: z.literal("infoBreak"),
  number: LooseOrdinal,
  content: z.string(),
});

export const LifeUsefulFactSchema = z.object({
  type: z.literal("lifeUsefulFact"),
  number: LooseOrdinal,
  content: z.string(),
});

/**
 * The escape hatch. Anything whose shape we could not pin gets carried across
 * verbatim rather than dropped, so the import can stay fail-loud without
 * blocking on perfect typing. A `legacyJson` block in Payload renders nothing;
 * its presence after the import is a to-do list.
 */
export const LegacyJsonSchema = z
  .object({ type: z.string() })
  .passthrough();

export const GrammarComponentSchema = z.discriminatedUnion("type", [
  PageSchema,
  MatchingExerciseSchema,
  DragAndDropExerciseSchema,
  MatchAudioExerciseSchema,
  PronunciationExerciseSchema,
  InfoBreakSchema,
  LifeUsefulFactSchema,
]);

export type GrammarComponent = z.infer<typeof GrammarComponentSchema>;

/** Every component type the import knows how to model as a real block. */
export const KNOWN_GRAMMAR_TYPES = [
  "page",
  "matchingExercise",
  "dragAndDropExercise",
  "matchAudioExercise",
  "pronunciationExercise",
  "infoBreak",
  "lifeUsefulFact",
] as const;

// ── Legacy-lesson exercises (the `lessons` exercises[] family) ────────────────

export const ConnectTheDotsSchema = z.object({
  type: z.literal("connectTheDots"),
  exerciseId: z.string(),
  items: z.array(z.string()),
  correctAnswers: z.array(z.string()),
  prompt: z.string().optional(),
});

export const MatchAudioLetterSchema = z.object({
  type: z.literal("matchAudioLetter"),
  exerciseId: z.string(),
  items: z.array(z.string()),
  /** Always length 1 in the data — a single answer stored as an array. */
  correctAnswers: z.array(z.string()),
  audioUrl: MediaUrlSchema.optional(),
  prompt: z.string().optional(),
});

export const VocabularyDragDropSchema = z.object({
  type: z.literal("vocabulary_drag_drop"),
  exerciseId: z.string(),
  characterBank: z.array(z.string()),
  correctAnswer: z.string(),
  prompt: z.string().optional(),
  audioUrl: MediaUrlSchema.optional(),
  imageUrl: MediaUrlSchema.optional(),
  /** Back-compat alias for `imageUrl` that some documents still use. */
  image: MediaUrlSchema.optional(),
  /** V2+ bonus batch — hiragana tiles with no Japanese caption hint. */
  bonus: z.boolean().optional(),
});

/**
 * An ungraded info card inserted between exercises. Zero live instances remain
 * (its only occurrence was in Airtable-only content, dropped in #26), but it
 * is part of the player contract and authors can still use it.
 */
export const FactBreakSchema = z.object({
  type: z.literal("factBreak"),
  exerciseId: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  prompt: z.string().optional(),
});

export const LegacyExerciseSchema = z.discriminatedUnion("type", [
  ConnectTheDotsSchema,
  MatchAudioLetterSchema,
  VocabularyDragDropSchema,
  FactBreakSchema,
]);

export type LegacyExercise = z.infer<typeof LegacyExerciseSchema>;

export const KNOWN_LEGACY_TYPES = [
  "connectTheDots",
  "matchAudioLetter",
  "vocabulary_drag_drop",
  "factBreak",
] as const;

// ── Lesson documents ──────────────────────────────────────────────────────────

/**
 * `flashcards` and `flashcardsAudio` are parallel arrays coupled by index, and
 * 9 of 11 surveyed lessons had the audio array missing entirely. The import
 * should zip them into one list of objects rather than carrying the coupling
 * forward.
 */
export const LegacyLessonSchema = z.object({
  slug: z.string(),
  title: z.string(),
  version: z.string().optional(),
  cardTitle: z.string().optional(),
  flashcards: z.array(z.string()).default([]),
  flashcardsAudio: z.array(MediaUrlSchema).optional(),
  funFact: z.string().optional(),
  notes: z.string().optional(),
  exercises: z.array(LegacyExerciseSchema).default([]),
  achievement: z.object({ title: z.string(), xp: z.number() }).optional(),
  prefecture: z.string(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Note `lesson` rather than `title` — the historical divergence between the
 * two collections. The Payload model normalises this to `title`; the import is
 * where the rename happens.
 */
export const GrammarLessonSchema = z.object({
  slug: z.string(),
  lesson: z.string(),
  cardTitle: z.string().optional(),
  items: z.array(GrammarComponentSchema).default([]),
  /** Lesson chaining. Not carried into Payload — course order replaces it. */
  nextSlug: z.string().optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const ResourceGroupSchema = z.object({
  category: z.string(),
  items: z.array(z.unknown()).default([]),
});
