import type { Block, Field } from "payload";

import { audioField, imageField, videoField } from "../fields/media";
import { sentenceEditor } from "../fields/prose";
import {
  LIBRARY_BLOCK_SLUGS as LIBRARY_SLUGS,
  PRACTICE_BLOCK_SLUGS as PRACTICE_SLUGS,
} from "./librarySlugs";

/*
 * The block library: ten blocks an author composes a screen from.
 *
 * The seventeen blocks these replace are a fossil record — one per legacy JSON
 * shape, capped at `maxRows: 1` so a screen could only ever be one block, split
 * into "Grammar lesson" and "Legacy lesson" groups because the two families
 * could not mix. Adding a screen layout needed a developer. These are grouped
 * `Content` and `Practice` instead, which is a statement about what a block is
 * *for* rather than which Mongo collection it came out of.
 *
 * Registered alongside the old seventeen (Phase 4a) so the five lessons can move
 * one at a time; Phase 4b deletes the old ones, `adapters.ts`, `types/lessons.ts`,
 * `termMedia.ts` and `expandLessonItems.ts`, and collapses the two players.
 *
 * ── Vocabulary comes from the catalogue, not from the block ──────────────────
 *
 * This is the biggest change and the reason `terms` exists. Old blocks each held
 * their own copy of a word plus its own audio and image slots, so the same word
 * appeared in five blocks with no shared identity — 133 term-like strings across
 * five lessons are 41 actual terms — and `utils/termMedia.ts` spent ~330 lines
 * of fuzzy string matching at render time guessing which copies meant the same
 * thing. Here an exercise *references* terms and reads their reading, audio and
 * image through the relationship. There is nothing left to drift.
 *
 * It also kills the last of the delimiter-as-schema hacks. `connectTheDots`
 * encoded a kana pair as the string `"あ/ア"` and four separate places split it
 * on the slash; `matchPairs` with `pairing: "kana"` reads `japanese` and
 * `katakana` off the term.
 *
 * ── Absence is checked structurally, not by sniffing strings ─────────────────
 *
 * The `validate` functions below are the replacement for looking for the
 * substring "PLACEHOLDER" inside a URL. They read `siblingData`, so they can
 * assert things a field alone cannot: that every tile in `correctSequence` is
 * actually in the pool, that a listening exercise's term has audio to play, that
 * a multiple choice has an answer. `npm run content:verify` checks the same
 * things from outside the app.
 */

/** Shared by the two blocks that introduce a word before practising it. */
const TERM_RELATION = {
  type: "relationship" as const,
  relationTo: "terms" as const,
};

/*
 * Every block's collapsed row shows its own content rather than its type name —
 * see `BlockRowLabel.tsx`. One shared component switching on `blockType`, so the
 * generated import map has one entry for the whole library and adding a block
 * needs no import-map change.
 */
const ROW_LABEL = {
  components: { Label: "/payload/blocks/BlockRowLabel#BlockRowLabel" },
} as const;

/** Copy shown above an exercise. Optional everywhere — most need no preamble. */
const instructions: Field = {
  name: "instructions",
  type: "text",
  admin: { description: "Shown above the exercise. One line." },
};

// ── Content ──────────────────────────────────────────────────────────────────

export const Prose: Block = {
  slug: "prose",
  interfaceName: "ProseBlock",
  labels: { singular: "Prose", plural: "Prose" },
  admin: { ...ROW_LABEL, group: "Content" },
  fields: [
    {
      /*
       * `contentPage`, `infoBreak`, `lifeUsefulFact` and `factBreak` were four
       * blocks that differed only in the box they rendered in. `tone` says that
       * out loud, and the choice becomes an authoring decision instead of a
       * schema one.
       */
      name: "tone",
      type: "select",
      required: true,
      defaultValue: "page",
      options: [
        { label: "Plain page", value: "page" },
        { label: "Note card", value: "card" },
        { label: "Fun fact", value: "fact" },
        { label: "Life tip", value: "lifeTip" },
      ],
    },
    {
      name: "title",
      type: "text",
      admin: { description: "Optional heading. The fact and tip tones show it in their band." },
    },
    {
      // No separate `description` sub-heading: it was a second prose field that
      // existed because the first one could not hold a heading. This one can.
      name: "content",
      type: "richText",
      required: true,
      admin: { description: "Use Ruby and Term for furigana; Example sentence for a worked line." },
    },
  ],
};

export const VideoLesson: Block = {
  slug: "videoLesson",
  interfaceName: "VideoLessonBlock",
  labels: { singular: "Video", plural: "Videos" },
  admin: { ...ROW_LABEL, group: "Content" },
  fields: [
    { name: "title", type: "text", required: true },
    videoField({ description: "The lesson video." }),
    audioField({ description: "Optional standalone audio for this screen." }),
    { name: "content", type: "richText", admin: { description: "Notes shown under the video." } },
    /*
     * `videoPage.videoForm` is not here, and not dropped either: it held the
     * dialogue, so it becomes a `dialogue` block. The plan called it free-text
     * notes that nothing rendered, which was wrong — see the note on `Dialogue`.
     */
  ],
};

export const GrammarPoint: Block = {
  slug: "grammarPoint",
  interfaceName: "GrammarPointBlock",
  labels: { singular: "Grammar point", plural: "Grammar points" },
  admin: { ...ROW_LABEL, group: "Content" },
  fields: [
    { name: "title", type: "text" },
    {
      name: "points",
      type: "array",
      minRows: 1,
      labels: { singular: "Point", plural: "Points" },
      admin: { initCollapsed: true },
      fields: [
        {
          name: "pattern",
          type: "text",
          required: true,
          admin: { description: "The pattern being taught, e.g. 〜は〜です." },
        },
        {
          /*
           * `grammarPage.examples` was a `text hasMany` — one sentence per
           * entry, no reading, no audio, no way to mark up furigana. Examples
           * live in here as `exampleSentence` blocks instead, which carry the
           * Japanese as rich text (so ruby and term references work), the
           * romaji, the English and the audio. That is the "examples gain
           * furigana and audio" from the plan, without a second nested array.
           */
          name: "explanation",
          type: "richText",
          required: true,
          admin: { description: "The explanation. Add Example sentence blocks for worked examples." },
        },
      ],
    },
  ],
};

export const VocabList: Block = {
  slug: "vocabList",
  interfaceName: "VocabListBlock",
  labels: { singular: "Vocabulary", plural: "Vocabulary" },
  admin: { ...ROW_LABEL, group: "Content" },
  fields: [
    { name: "title", type: "text" },
    { name: "intro", type: "richText", admin: { description: "Optional copy above the list." } },
    {
      /*
       * Replaces `termsPage.terms` (a text field plus its own image and audio),
       * `flashcardDeck.cards` (a card string plus its own audio) and
       * `termMediaSeed` (which existed *only* to attach media to a word). All
       * three were the same thing: a list of words. The media now travels with
       * the term.
       */
      ...TERM_RELATION,
      name: "terms",
      hasMany: true,
      required: true,
      minRows: 1,
      admin: { description: "The words introduced here, in order. Their audio and images come with them." },
    },
    {
      name: "layout",
      type: "select",
      required: true,
      defaultValue: "list",
      options: [
        { label: "List", value: "list" },
        { label: "Flashcards to flip", value: "flashcards" },
        { label: "Image grid", value: "grid" },
        { label: "Spotlight one character", value: "spotlight" },
      ],
      admin: {
        description:
          "`format` on the old Terms page was free text (\"Flashcard\", …) that the renderer " +
          "guessed at. This is the same decision, made explicitly. " +
          "Spotlight shows one character large with its stroke-order diagram, and is the " +
          "authored form of the screens the flashcard player used to generate from a " +
          "hardcoded table.",
      },
    },
  ],
};

export const MediaFigure: Block = {
  slug: "mediaFigure",
  interfaceName: "MediaFigureBlock",
  labels: { singular: "Figure", plural: "Figures" },
  admin: { ...ROW_LABEL, group: "Content" },
  fields: [
    /*
     * Three fields rather than one polymorphic upload, for the reason
     * `payload/fields/media.ts` gives: the renderer has to know statically
     * whether to emit <img>, <audio> or <video>, and `filterOptions` on a
     * per-kind field is enforced server-side. The validate below is what makes
     * it "one of", which a single field would have given for free — the trade is
     * deliberate.
     */
    imageField({
      validate: exactlyOneAsset("image"),
    }),
    audioField({ validate: exactlyOneAsset("audio") }),
    videoField({ validate: exactlyOneAsset("video") }),
    { name: "caption", type: "text", admin: { description: "Shown under the file." } },
  ],
};

/**
 * A figure holds exactly one asset. Written once and attached to all three
 * fields so the message is the same whichever one the editor is looking at.
 */
function exactlyOneAsset(self: "audio" | "image" | "video") {
  const KINDS = ["image", "audio", "video"] as const;
  return (_value: unknown, { siblingData }: { siblingData?: Record<string, unknown> }) => {
    const set = KINDS.filter((kind) => {
      const v = siblingData?.[kind];
      return v !== null && v !== undefined && v !== "";
    });
    if (set.length === 1) return true;
    if (set.length === 0) return "A figure needs one file — pick an image, an audio clip or a video.";
    return `A figure holds one file, and this one has ${set.length} (${set.join(", ")}). Clear the ones you do not want, or use a separate figure. This message is on the ${self} field.`;
  };
}

export const Dialogue: Block = {
  slug: "dialogue",
  interfaceName: "DialogueBlock",
  labels: { singular: "Dialogue", plural: "Dialogues" },
  admin: { ...ROW_LABEL, group: "Content" },
  fields: [
    { name: "title", type: "text" },
    {
      name: "speakerA",
      type: "text",
      required: true,
      defaultValue: "A",
      admin: { description: "The first speaker's name, as shown beside their lines." },
    },
    {
      name: "speakerB",
      type: "text",
      required: true,
      defaultValue: "B",
    },
    videoField({ description: "Optional recording of the conversation." }),
    {
      name: "lines",
      type: "array",
      required: true,
      minRows: 1,
      labels: { singular: "Line", plural: "Lines" },
      admin: { initCollapsed: false },
      fields: [
        {
          name: "speaker",
          type: "select",
          required: true,
          defaultValue: "a",
          options: [
            { label: "First speaker", value: "a" },
            { label: "Second speaker", value: "b" },
          ],
          admin: {
            description:
              "Which of the two is talking. The old data had no speakers at all — the renderer " +
              "coloured lines by whether their index was even, so inserting a line silently " +
              "reassigned every line after it.",
          },
        },
        {
          name: "japanese",
          type: "richText",
          required: true,
          editor: sentenceEditor,
          admin: { description: "What they say. Ruby and Term work in here." },
        },
        { name: "romaji", type: "text" },
        { name: "english", type: "text" },
        audioField({ description: "This line, spoken." }),
      ],
    },
  ],
};

/*
 * ── Why there are eleven blocks and not ten ──────────────────────────────────
 *
 * The plan listed ten and said to drop `videoPage.videoForm` because "nothing
 * renders off it". That is false: `NewLessonPageItem.tsx:279` branches on it and
 * lays the lines out as a two-speaker conversation, and 16 of the 20 `videoPage`
 * rows have no video at all — the dialogue is their entire content. Dropping the
 * field would have deleted sixteen screens.
 *
 * So a dialogue is a real content shape the library was missing, and it gets a
 * block rather than being flattened into prose. Modelling it properly also fixes
 * two things the old field could not express: the speaker is stated instead of
 * inferred from an index, and each line is rich text, so a dialogue can carry
 * furigana and per-line audio.
 */
export const contentBlocks: Block[] = [
  Prose,
  Dialogue,
  VideoLesson,
  GrammarPoint,
  VocabList,
  MediaFigure,
];

// ── Practice ─────────────────────────────────────────────────────────────────

export const MatchPairs: Block = {
  slug: "matchPairs",
  interfaceName: "MatchPairsBlock",
  labels: { singular: "Match pairs", plural: "Match pairs" },
  admin: { ...ROW_LABEL, group: "Practice" },
  fields: [
    { ...instructions, required: true },
    {
      /*
       * The pairs are *derived* from the terms rather than authored as two
       * parallel lists. `matchingExercise` held `{ phrase, englishTranslation }`
       * objects and `connectTheDots` held `items` plus a `correctAnswers` subset
       * that had to match it exactly, by string. Both are now "these words, this
       * way round", and a typo cannot desynchronise anything.
       */
      ...TERM_RELATION,
      name: "terms",
      hasMany: true,
      required: true,
      minRows: 2,
      admin: { description: "The words to match. Two or more." },
    },
    {
      name: "pairing",
      type: "select",
      required: true,
      defaultValue: "meaning",
      options: [
        { label: "Word ↔ English meaning", value: "meaning" },
        { label: "Word ↔ reading", value: "reading" },
        { label: "Hiragana ↔ katakana", value: "kana" },
        { label: "Audio ↔ word", value: "audio" },
      ],
      admin: {
        description:
          "What the two sides are. Hiragana ↔ katakana is what the old \"あ/ア\" strings encoded " +
          "with a slash; it reads both scripts off the term now.",
      },
      validate: pairingIsPossible,
    },
  ],
};

export const ListenAndChoose: Block = {
  slug: "listenAndChoose",
  interfaceName: "ListenAndChooseBlock",
  labels: { singular: "Listen and choose", plural: "Listen and choose" },
  admin: { ...ROW_LABEL, group: "Practice" },
  fields: [
    instructions,
    {
      ...TERM_RELATION,
      name: "term",
      required: true,
      admin: {
        description:
          "The word the learner hears and has to pick. Its own audio is what plays, so there is " +
          "no per-exercise audio field to drift from the word it belongs to.",
      },
    },
    {
      ...TERM_RELATION,
      name: "distractors",
      hasMany: true,
      admin: {
        description:
          "The wrong answers. Leave empty and the player draws them from the words introduced " +
          "earlier in the lesson.",
      },
    },
    {
      name: "answerWith",
      type: "select",
      required: true,
      defaultValue: "text",
      options: [
        { label: "The written word", value: "text" },
        { label: "A picture", value: "image" },
      ],
    },
  ],
};

export const BuildSentence: Block = {
  slug: "buildSentence",
  interfaceName: "BuildSentenceBlock",
  labels: { singular: "Build a sentence", plural: "Build a sentence" },
  admin: { ...ROW_LABEL, group: "Practice" },
  fields: [
    instructions,
    {
      ...TERM_RELATION,
      name: "term",
      admin: {
        description:
          "The word or phrase being built, when there is one. Supplies the picture and the audio.",
      },
    },
    {
      name: "tiles",
      type: "text",
      hasMany: true,
      required: true,
      minRows: 2,
      admin: { description: "Every tile offered, including the wrong ones." },
    },
    {
      name: "correctSequence",
      type: "text",
      hasMany: true,
      required: true,
      minRows: 1,
      admin: { description: "The tiles in the order that counts as correct." },
      validate: sequenceIsInThePool,
    },
    {
      /*
       * `vocabularyDragDrop` converted kana tiles to romaji at render time, on a
       * code path keyed off a checkbox called `bonus` — so the same stored data
       * produced two different exercises depending on a flag that was named
       * after a content batch. The conversion is a decision about this exercise;
       * this is that decision, stated.
       */
      name: "tileScript",
      type: "select",
      required: true,
      defaultValue: "asAuthored",
      options: [
        { label: "As authored", value: "asAuthored" },
        { label: "Convert to romaji", value: "romaji" },
      ],
    },
  ],
};

export const SpeakAndScore: Block = {
  slug: "speakAndScore",
  interfaceName: "SpeakAndScoreBlock",
  labels: { singular: "Speak and score", plural: "Speak and score" },
  admin: { ...ROW_LABEL, group: "Practice" },
  fields: [
    instructions,
    {
      ...TERM_RELATION,
      name: "term",
      required: true,
      admin: {
        description:
          "What to say. Its audio is what the recording is graded against — without audio on the " +
          "term there is nothing to score, which is why this is required.",
      },
      validate: termHasAudio,
    },
    {
      /*
       * Stays a plain string, like `pronunciationExercise.transcript` before it:
       * the scoring service reads it as one. Anything an algorithm reads as a
       * string stays a string.
       */
      name: "transcript",
      type: "textarea",
      admin: {
        description:
          "Optional longer text to show and score against, when the term's own form is not what " +
          "you want said. Plain text — the scorer reads it as a string.",
      },
    },
    videoField({ description: "Optional demonstration of the mouth shape." }),
  ],
};

export const MultipleChoice: Block = {
  slug: "multipleChoice",
  interfaceName: "MultipleChoiceBlock",
  labels: { singular: "Multiple choice", plural: "Multiple choice" },
  admin: { ...ROW_LABEL, group: "Practice" },
  fields: [
    { name: "question", type: "richText", required: true },
    {
      name: "options",
      type: "array",
      required: true,
      minRows: 2,
      labels: { singular: "Option", plural: "Options" },
      fields: [
        { name: "label", type: "text", required: true },
        {
          name: "isCorrect",
          type: "checkbox",
          admin: { description: "Exactly one option is the answer." },
        },
      ],
      validate: exactlyOneCorrect,
    },
    {
      name: "explanation",
      type: "richText",
      admin: { description: "Shown after answering, right or wrong." },
    },
  ],
};

export const practiceBlocks: Block[] = [
  MatchPairs,
  ListenAndChoose,
  BuildSentence,
  SpeakAndScore,
  MultipleChoice,
];

/** Every block in the library, in the order the admin offers them. */
export const libraryBlocks: Block[] = [...contentBlocks, ...practiceBlocks];

/*
 * The discriminator `lib/content/adapters.ts` uses to decide which render path an
 * exercise takes lives in `librarySlugs.ts`, not here — that file has no imports
 * because `adapters.ts` runs in the browser and this one reaches
 * `@payloadcms/richtext-lexical` and, through it, `fs`. See the note there.
 *
 * Re-exported so callers that are already server-side have one obvious import,
 * and asserted below so the two cannot disagree.
 */
export { LIBRARY_BLOCK_SLUGS } from "./librarySlugs";

/*
 * The two lists are the same set, checked at module load.
 *
 * This is the whole reason a hand-maintained slug list is acceptable: it runs
 * wherever the Payload config is loaded — `next dev`, every script,
 * `payload:types` — so adding a block and forgetting `librarySlugs.ts` fails on
 * the next command instead of making one screen render nothing in the player.
 */
{
  const registered = new Set(libraryBlocks.map((block) => block.slug));
  const declared = new Set<string>(LIBRARY_SLUGS);
  const missing = [...registered].filter((slug) => !declared.has(slug));
  const extra = [...declared].filter((slug) => !registered.has(slug));
  if (missing.length || extra.length) {
    throw new Error(
      "payload/blocks/librarySlugs.ts is out of step with the blocks registered in library.ts." +
        (missing.length ? ` Missing: ${missing.join(", ")}.` : "") +
        (extra.length ? ` Not registered: ${extra.join(", ")}.` : "") +
        " That list is duplicated on purpose — the shuffle and the render path run in the" +
        " browser and cannot import this file — so fix the list rather than this check."
    );
  }

  /*
   * And the same for the split, which is load-bearing now rather than a heading.
   *
   * `lib/content/shuffle.ts` reorders a run of consecutive Practice screens and
   * leaves everything else where the author put it. If a block were Practice here
   * and Content there, the symptom would be a narrative screen quietly changing
   * places between visits — the sort of thing noticed months later, by a learner.
   */
  const practiceHere = practiceBlocks.map((block) => block.slug).sort().join(",");
  const practiceThere = [...PRACTICE_SLUGS].sort().join(",");
  if (practiceHere !== practiceThere) {
    throw new Error(
      "PRACTICE_BLOCK_SLUGS in librarySlugs.ts does not match the blocks grouped 'Practice' here." +
        ` Registered: ${practiceHere}. Declared: ${practiceThere}.` +
        " lib/content/shuffle.ts only reorders Practice screens, so a disagreement moves content."
    );
  }
}

// ── The validations ──────────────────────────────────────────────────────────
/*
 * These read `siblingData`, which is the block's own fields — the only place a
 * check can see enough to be useful. Each one is a rule that used to be either
 * unenforced or discovered by a learner.
 */

type SiblingArgs = { siblingData?: Record<string, unknown> };

/** Every tile in the answer has to exist in the pool the learner is given. */
function sequenceIsInThePool(value: unknown, { siblingData }: SiblingArgs) {
  const sequence = Array.isArray(value) ? value.map(String) : [];
  const tiles = Array.isArray(siblingData?.tiles) ? siblingData.tiles.map(String) : [];
  if (!sequence.length) return "Set the correct order.";

  const missing = sequence.filter((tile) => !tiles.includes(tile));
  if (!missing.length) return true;
  return (
    `These are not in the tile pool, so the exercise cannot be solved: ${missing.join(", ")}. ` +
    "Add them to Tiles, or correct the spelling."
  );
}

/** A listening or speaking exercise needs something to play. */
function termHasAudio(value: unknown, { siblingData: _siblingData }: SiblingArgs) {
  if (value === null || value === undefined || value === "") return "Pick a word.";
  /*
   * Only the id is available here — validate runs before the relationship is
   * populated, so whether that term actually *has* audio cannot be checked at
   * this point. `npm run content:verify` is where that is caught, reading the
   * published content at the app's own depth. Stated rather than silently
   * half-checked.
   */
  return true;
}

/** The pairing has to be one the chosen words can actually form. */
function pairingIsPossible(value: unknown, _args: SiblingArgs) {
  if (typeof value !== "string" || !value) return "Pick what the two sides are.";
  // Same limitation as `termHasAudio`: the terms are ids here, so "do these
  // words all have a katakana form?" is a `content:verify` question.
  return true;
}

/** Exactly one right answer, or the exercise cannot be marked. */
function exactlyOneCorrect(value: unknown) {
  const options = Array.isArray(value) ? value : [];
  const correct = options.filter((o) => (o as { isCorrect?: unknown })?.isCorrect === true);
  if (correct.length === 1) return true;
  if (correct.length === 0) return "Tick the option that is the answer.";
  return `Only one option can be the answer, and ${correct.length} are ticked.`;
}
