import type { Block } from "payload";

import { audioField, imageField, videoField } from "../fields/media";

/*
 * Component blocks for the grammar-lesson family (the old `newlessons`
 * `items[]`).
 *
 * One block per entry in `KNOWN_GRAMMAR_TYPES` in
 * `src/lib/content/item-schemas.ts` — with two deliberate splits that the
 * audit (`scripts/migrate/out/items-audit.md`) forced:
 *
 *  - `page` was a kitchen sink holding three disjoint shapes behind one type.
 *    `classifyPage()` is the discriminator; it becomes `videoPage`,
 *    `termsPage` and `grammarPage` here, plus `contentPage` for the "bare"
 *    variant that carries only prose.
 *  - `dragAndDropExercise` was two unrelated things: a real puzzle (7 of 24
 *    observed) and a media seed for the old render-time expander (the other
 *    17). `isDragAndDropPuzzle()` is the discriminator; they become
 *    `dragAndDropPuzzle` and `termMediaSeed`.
 *
 * Field names match the zod schemas except where Payload cannot express them:
 *  - Media fields are `image` / `audio` / `video`, `upload` relationships to
 *    the `media` collection rather than the `imageUrl` / `audioUrl` / `videoUrl`
 *    strings the zod schemas describe. (`page.audioURL` in the raw Mongo data
 *    was already being normalised to `audioUrl` before that.) See
 *    `payload/fields/media.ts`.
 *  - `dragAndDropExercise._term` becomes `term` — Payload reserves the
 *    underscore prefix for its own columns.
 *  - `number` is not modelled at all: it is present on ~40% of items and is
 *    non-monotonic in `l1-v2`. Array position is the ordering.
 *
 * On table naming: block tables are `lessons_blocks_<block_slug_snake_cased>`
 * regardless of how deeply the blocks field is nested — neither the blocks
 * field name nor the enclosing `exercises` array appears, and a `_path` column
 * records where the row actually lives. Do not set `dbName` on a block to
 * shorten things: it replaces the whole table name, prefix included.
 */

const PAGE_PROSE = [
  {
    name: "description",
    type: "textarea" as const,
    admin: { description: "Optional sub-heading shown under the title." },
  },
  {
    name: "content",
    type: "textarea" as const,
    admin: { description: "Optional body copy shown under the description." },
  },
];

export const VideoPage: Block = {
  slug: "videoPage",
  interfaceName: "VideoPageBlock",
  labels: { singular: "Page — Video", plural: "Pages — Video" },
  admin: {
    group: "Grammar lesson",
  },
  fields: [
    { name: "title", type: "text", required: true },
    videoField({ description: "The lesson video." }),
    {
      name: "videoForm",
      type: "text",
      hasMany: true,
      admin: {
        description:
          "Free-text notes about the video's form, carried over from the source data. " +
          "Purely descriptive — nothing renders off it.",
      },
    },
    audioField({ description: "Optional standalone audio for this page (stored as `audioURL` in the old data)." }),
    ...PAGE_PROSE,
  ],
};

export const TermsPage: Block = {
  slug: "termsPage",
  interfaceName: "TermsPageBlock",
  labels: { singular: "Page — Terms", plural: "Pages — Terms" },
  admin: { group: "Grammar lesson" },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "format",
      type: "text",
      admin: {
        description:
          'Free text in the source data ("Flashcard", …), not an enum. Presentation hint only.',
      },
    },
    {
      name: "terms",
      type: "array",
      admin: {
        description: "The vocabulary introduced on this page, in display order.",
      },
      fields: [
        { name: "term", type: "text", required: true },
        imageField(),
        audioField(),
      ],
    },
    ...PAGE_PROSE,
  ],
};

export const GrammarPage: Block = {
  slug: "grammarPage",
  interfaceName: "GrammarPageBlock",
  labels: { singular: "Page — Grammar", plural: "Pages — Grammar" },
  admin: { group: "Grammar lesson" },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "grammarPoints",
      type: "array",
      fields: [
        {
          name: "pattern",
          type: "text",
          required: true,
          admin: { description: "The pattern being taught, e.g. `〜は〜です`." },
        },
        {
          name: "examples",
          type: "text",
          hasMany: true,
          admin: { description: "One sentence per entry." },
        },
      ],
    },
    ...PAGE_PROSE,
  ],
};

export const ContentPage: Block = {
  slug: "contentPage",
  interfaceName: "ContentPageBlock",
  labels: { singular: "Page — Text only", plural: "Pages — Text only" },
  admin: {
    group: "Grammar lesson",
  },
  fields: [
    { name: "title", type: "text", required: true },
    ...PAGE_PROSE,
  ],
};

export const MatchingExercise: Block = {
  slug: "matchingExercise",
  interfaceName: "MatchingExerciseBlock",
  labels: { singular: "Matching exercise", plural: "Matching exercises" },
  admin: { group: "Grammar lesson" },
  fields: [
    { name: "instructions", type: "text", required: true },
    {
      name: "items",
      type: "array",
      minRows: 1,
      admin: { description: "The pairs the learner has to match." },
      fields: [
        { name: "phrase", type: "text", required: true },
        { name: "englishTranslation", type: "text" },
        audioField(),
        imageField(),
      ],
    },
    {
      name: "rows",
      type: "text",
      hasMany: true,
      admin: {
        description:
          'Free-text layout hints from the source data ("audio buttons", "image"). Presentation only.',
      },
    },
    {
      name: "dragDropOptions",
      type: "text",
      hasMany: true,
      admin: {
        description:
          "Author-curated wrong answers. Leave empty to let the player derive distractors " +
          "from the terms introduced earlier in the lesson.",
      },
    },
    { name: "description", type: "textarea" },
  ],
};

export const DragAndDropPuzzle: Block = {
  slug: "dragAndDropPuzzle",
  interfaceName: "DragAndDropPuzzleBlock",
  labels: { singular: "Drag & drop puzzle", plural: "Drag & drop puzzles" },
  admin: {
    group: "Grammar lesson",
  },
  fields: [
    {
      name: "term",
      type: "text",
      required: true,
      admin: {
        description:
          "The term this puzzle is about. Stored as `_term` in the source data — it is the " +
          "only identifying field these carried.",
      },
    },
    {
      name: "correctSequence",
      type: "text",
      hasMany: true,
      required: true,
      admin: { description: "The tiles in the order that counts as correct." },
    },
    {
      name: "options",
      type: "text",
      hasMany: true,
      required: true,
      admin: { description: "Every tile offered, including the wrong ones." },
    },
    audioField(),
    imageField(),
  ],
};

export const TermMediaSeed: Block = {
  slug: "termMediaSeed",
  interfaceName: "TermMediaSeedBlock",
  labels: { singular: "Term media (not an exercise)", plural: "Term media (not exercises)" },
  admin: {
    group: "Grammar lesson",
  },
  fields: [
    {
      name: "term",
      type: "text",
      required: true,
      admin: { description: "Stored as `_term` in the source data." },
    },
    audioField(),
    imageField(),
  ],
};

export const MatchAudioExercise: Block = {
  slug: "matchAudioExercise",
  interfaceName: "MatchAudioExerciseBlock",
  labels: { singular: "Match audio", plural: "Match audio" },
  admin: { group: "Grammar lesson" },
  fields: [
    { name: "phrase", type: "text", required: true },
    audioField({ description: "The clip the learner hears." }),
    imageField(),
  ],
};

export const PronunciationExercise: Block = {
  slug: "pronunciationExercise",
  interfaceName: "PronunciationExerciseBlock",
  labels: { singular: "Pronunciation", plural: "Pronunciation" },
  admin: { group: "Grammar lesson" },
  fields: [
    { name: "phrase", type: "text", required: true },
    {
      name: "transcript",
      type: "textarea",
      admin: { description: "Longer display text. The player falls back to the phrase if empty." },
    },
    videoField({ description: "Optional demonstration video." }),
    audioField({ description: "Dedicated reference audio for scoring — NOT the video's audio track. " +
        "Without it the pronunciation service has nothing to grade against." }),
  ],
};

export const InfoBreak: Block = {
  slug: "infoBreak",
  interfaceName: "InfoBreakBlock",
  labels: { singular: "Info break", plural: "Info breaks" },
  admin: { group: "Grammar lesson" },
  fields: [
    {
      name: "content",
      type: "textarea",
      required: true,
      admin: {
        description:
          "Ungraded copy shown between exercises. Some imported bodies are authoring briefs " +
          "rather than learner-facing text — those need an editorial pass.",
      },
    },
  ],
};

export const LifeUsefulFact: Block = {
  slug: "lifeUsefulFact",
  interfaceName: "LifeUsefulFactBlock",
  labels: { singular: "Life-useful fact", plural: "Life-useful facts" },
  admin: { group: "Grammar lesson" },
  fields: [
    { name: "content", type: "textarea", required: true },
  ],
};

export const grammarBlocks: Block[] = [
  VideoPage,
  TermsPage,
  GrammarPage,
  ContentPage,
  MatchingExercise,
  DragAndDropPuzzle,
  TermMediaSeed,
  MatchAudioExercise,
  PronunciationExercise,
  InfoBreak,
  LifeUsefulFact,
];
