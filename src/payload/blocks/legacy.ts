import type { Block } from "payload";

import { audioField, imageField } from "../fields/media";

/*
 * Component blocks for the legacy prefecture/hiragana lesson family (the old
 * `lessons` `exercises[]`), one per entry in `KNOWN_LEGACY_TYPES`, plus:
 *
 *  - `flashcardDeck`, which replaces the lesson-level `flashcards` /
 *    `flashcardsAudio` pair. Those were index-coupled parallel arrays and 9 of
 *    11 surveyed lessons had the audio array missing entirely, so the two could
 *    silently drift out of alignment. Here they are one list of objects and the
 *    coupling cannot be broken.
 *  - `legacyJson`, the escape hatch for shapes the audit could not pin.
 *
 * `items` / `correctAnswers` on `connectTheDots` and `matchAudioLetter` stay as
 * the zod schemas describe them (two parallel string lists) rather than being
 * folded into `{ label, isCorrect }` objects. That is deliberate: the zod
 * schemas are the agreed contract for this migration and the player already
 * consumes this shape. Tightening it is a follow-up, not a silent change here.
 */

export const ConnectTheDots: Block = {
  slug: "connectTheDots",
  interfaceName: "ConnectTheDotsBlock",
  labels: { singular: "Connect the dots", plural: "Connect the dots" },
  admin: { group: "Legacy lesson" },
  fields: [
    {
      name: "exerciseId",
      type: "text",
      required: true,
      admin: {
        description:
          "Stable, human-meaningful id (e.g. `l3_vocab_5_bonus`). Progress and attempt " +
          "records key off it — changing it detaches existing learner progress.",
      },
    },
    { name: "prompt", type: "text" },
    {
      name: "items",
      type: "text",
      hasMany: true,
      required: true,
      admin: { description: "Every option shown to the learner." },
    },
    {
      name: "correctAnswers",
      type: "text",
      hasMany: true,
      required: true,
      admin: { description: "The subset of `items` that counts as correct. Match them exactly." },
    },
  ],
};

export const MatchAudioLetter: Block = {
  slug: "matchAudioLetter",
  interfaceName: "MatchAudioLetterBlock",
  labels: { singular: "Match audio to letter", plural: "Match audio to letter" },
  admin: { group: "Legacy lesson" },
  fields: [
    {
      name: "exerciseId",
      type: "text",
      required: true,
      admin: { description: "Stable id — see the note on Connect the dots." },
    },
    { name: "prompt", type: "text" },
    audioField({ description: "The clip the learner hears." }),
    {
      name: "items",
      type: "text",
      hasMany: true,
      required: true,
      admin: { description: "Every letter offered." },
    },
    {
      name: "correctAnswers",
      type: "text",
      hasMany: true,
      required: true,
      admin: {
        description:
          "A list for historical reasons — every observed record has exactly one entry. " +
          "Add one unless you know the player handles more.",
      },
    },
  ],
};

export const VocabularyDragDrop: Block = {
  slug: "vocabularyDragDrop",
  interfaceName: "VocabularyDragDropBlock",
  labels: { singular: "Vocabulary drag & drop", plural: "Vocabulary drag & drop" },
  admin: {
    group: "Legacy lesson",
  },
  fields: [
    {
      name: "exerciseId",
      type: "text",
      required: true,
      admin: { description: "Stable id — see the note on Connect the dots." },
    },
    { name: "prompt", type: "text" },
    {
      name: "characterBank",
      type: "text",
      hasMany: true,
      required: true,
      admin: { description: "The tiles offered, including distractors." },
    },
    {
      name: "correctAnswer",
      type: "text",
      required: true,
      admin: { description: "The assembled answer, as one string." },
    },
    audioField(),
    /*
     * There used to be a second field here, `image`, a back-compat alias for
     * documents that spelled `imageUrl` that way. It is gone: no row in the
     * content snapshot ever set it (nor `imageUrl`, on any of the 11 blocks of
     * this type), and the upload rename would have collided the alias with the
     * canonical field anyway. `DragDrop.tsx` still reads `imageUrl || image`;
     * that fallback goes with the adapter in Phase 4.
     */
    imageField(),
    {
      name: "bonus",
      type: "checkbox",
      admin: {
        description:
          "V2+ bonus batch: hiragana tiles with no Japanese caption hint. Harder variant.",
      },
    },
  ],
};

export const FactBreak: Block = {
  slug: "factBreak",
  interfaceName: "FactBreakBlock",
  labels: { singular: "Fact break", plural: "Fact breaks" },
  admin: { group: "Legacy lesson" },
  fields: [
    {
      name: "exerciseId",
      type: "text",
      required: true,
      admin: { description: "Stable id — see the note on Connect the dots." },
    },
    { name: "title", type: "text" },
    { name: "content", type: "textarea" },
    { name: "prompt", type: "text" },
  ],
};

export const FlashcardDeck: Block = {
  slug: "flashcardDeck",
  interfaceName: "FlashcardDeckBlock",
  labels: { singular: "Flashcard deck", plural: "Flashcard decks" },
  admin: {
    group: "Legacy lesson",
  },
  fields: [
    {
      name: "title",
      type: "text",
      admin: { description: "Optional heading for the deck." },
    },
    {
      name: "cards",
      type: "array",
      minRows: 1,
      admin: {
        description:
          "Replaces the old `flashcards` / `flashcardsAudio` parallel arrays — card and audio " +
          "travel together, so they cannot fall out of alignment.",
      },
      fields: [
        {
          name: "card",
          type: "text",
          required: true,
          admin: { description: 'The card face, e.g. "あ/ア".' },
        },
        audioField({ description: "Optional pronunciation for this card." }),
      ],
    },
  ],
};

export const LegacyJson: Block = {
  slug: "legacyJson",
  interfaceName: "LegacyJsonBlock",
  labels: { singular: "Unmigrated content", plural: "Unmigrated content" },
  admin: {
    group: "Needs attention",
  },
  fields: [
    {
      name: "originalType",
      type: "text",
      required: true,
      admin: { description: "The `type` string the source document carried." },
    },
    {
      name: "data",
      type: "json",
      required: true,
      admin: {
        description:
          "The source item, carried across verbatim because the import did not recognise its " +
          "shape. This renders nothing. Every one of these is a to-do: re-author it as a real " +
          "block, or delete it.",
      },
    },
  ],
};

export const legacyBlocks: Block[] = [
  ConnectTheDots,
  MatchAudioLetter,
  VocabularyDragDrop,
  FactBreak,
  FlashcardDeck,
];

export const escapeHatchBlocks: Block[] = [LegacyJson];
