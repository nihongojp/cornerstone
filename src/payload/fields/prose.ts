import {
  BlocksFeature,
  FixedToolbarFeature,
  RelationshipFeature,
  UploadFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical";
import type { Block } from "payload";

import { audioField } from "./media";

/*
 * Rich text, and the two inline blocks that make furigana authorable.
 *
 * Everything prose-shaped in the CMS used to be a `textarea` rendered through
 * `<Typography>{item.content}</Typography>`: no emphasis, no lists, no links,
 * no images inside a paragraph, and — the reason this phase exists — no ruby.
 * Japanese teaching material without furigana is missing its main
 * accessibility affordance.
 *
 * ── One editor, defined here, set at the top level ───────────────────────────
 *
 * `proseEditor` is registered as `editor` in `payload.config.ts` rather than on
 * each field. A `richText` field with no `editor` of its own inherits the root
 * one, so every field added from here on gets the same toolbar and the same
 * blocks without anyone remembering to wire it up. The alternative — an
 * `editor:` on each of the nine fields — is nine chances for two of them to
 * disagree about what an author can write.
 *
 * ── Furigana is data on the Term, and two inline blocks for authoring ────────
 *
 * The Term already carries `furigana` as `{ base, ruby }` segments (Phase 2).
 * What was missing was any way to *use* it in a sentence. Two inline blocks:
 *
 *  - `termRef` renders a term from the catalogue, ruby included, and is the
 *    first real consumer of `terms` — reference the word once and its reading,
 *    audio and gloss follow it everywhere.
 *  - `ruby` is a one-off reading for incidental kanji. Without it, furigana on
 *    an ordinary sentence would require creating a catalogue entry for every
 *    character in it, which nobody will do, and furigana quietly stops being
 *    used.
 *
 * Two alternatives were considered and rejected (see the plan):
 *
 *  - **Not a Lexical text format.** Ruby is a tree — `<ruby>base<rt>reading</rt></ruby>`
 *    — and a Lexical format is a bitfield on a text node. Structurally impossible.
 *  - **Not a custom Lexical node**, not in v1. That is a `DecoratorNode` subclass,
 *    `importJSON`/`exportJSON`, a client plugin, a toolbar entry and an
 *    import-map registration: several hundred lines of upgrade risk owned
 *    against a pinned 3.88.0 with no test suite, to replace an admin form that
 *    inline blocks give for free.
 *
 * ── Lexical blocks cost no schema ───────────────────────────────────────────
 *
 * A block's fields serialize into the parent field's JSON, so none of the
 * blocks below add a table or a column. Adding one later needs no migration —
 * only `npm run payload:importmap`, because its admin components are registered
 * in the generated import map.
 */

/** Shown on a `termRef`, in place of the term itself. */
const TERM_DISPLAY = [
  { label: "Japanese with furigana", value: "furigana" },
  { label: "Japanese only", value: "plain" },
  { label: "Kana reading", value: "reading" },
  { label: "Romaji", value: "romaji" },
  { label: "English meaning", value: "meaning" },
] as const;

export const Ruby: Block = {
  slug: "ruby",
  interfaceName: "RubyInlineBlock",
  labels: { singular: "Ruby", plural: "Ruby" },
  fields: [
    {
      name: "base",
      type: "text",
      required: true,
      admin: { description: "The characters the reading sits above — 漢字." },
    },
    {
      name: "ruby",
      type: "text",
      required: true,
      admin: { description: "The reading — かんじ." },
    },
  ],
};

export const TermRef: Block = {
  slug: "termRef",
  interfaceName: "TermRefInlineBlock",
  labels: { singular: "Term", plural: "Terms" },
  fields: [
    {
      name: "term",
      type: "relationship",
      relationTo: "terms",
      required: true,
      admin: {
        description:
          "A word from the vocabulary catalogue. Its reading, furigana and audio come with it, " +
          "so correcting the term corrects every sentence that references it.",
      },
    },
    {
      name: "display",
      type: "select",
      required: true,
      defaultValue: "furigana",
      options: [...TERM_DISPLAY],
      admin: {
        description:
          "Which form of the term to show here. Falls back to the reading and then the romaji " +
          "for the entries that have no Japanese script yet.",
      },
    },
    {
      name: "showAudio",
      type: "checkbox",
      admin: {
        description:
          "Add a play button after the word, using the term's own pronunciation audio. " +
          "Nothing renders if the term has no audio.",
      },
    },
  ],
};

/**
 * Inline blocks, exported for the snapshot walker as well as the editor.
 *
 * `scripts/content/lib/snapshot.ts` needs these to find the relationship inside
 * a `termRef` — a reference nested in Lexical JSON is a bare integer with
 * nothing to mark it as a reference, so the only way to make it portable is to
 * know the block's field schema. Importing the same array the editor is built
 * from means there is no second list to fall out of step.
 */
export const PROSE_INLINE_BLOCKS: Block[] = [Ruby, TermRef];

/*
 * The editor used *inside* a block, for one sentence.
 *
 * A `richText` field with no editor of its own inherits the root one, which
 * would put every block below inside itself — a callout inside a callout inside
 * a callout. This is the same surface minus the block-level blocks: emphasis,
 * and the two things a Japanese sentence needs, which are ruby and a term
 * reference.
 */
export const sentenceEditor = lexicalEditor({
  features: [
    BlocksFeature({ inlineBlocks: PROSE_INLINE_BLOCKS }),
    FixedToolbarFeature(),
  ],
});

export const Callout: Block = {
  slug: "callout",
  interfaceName: "CalloutProseBlock",
  labels: { singular: "Callout", plural: "Callouts" },
  fields: [
    {
      name: "tone",
      type: "select",
      required: true,
      defaultValue: "note",
      options: [
        { label: "Note", value: "note" },
        { label: "Tip", value: "tip" },
        { label: "Watch out", value: "warning" },
      ],
    },
    { name: "title", type: "text" },
    { name: "content", type: "richText", required: true, editor: sentenceEditor },
  ],
};

export const ExampleSentence: Block = {
  slug: "exampleSentence",
  interfaceName: "ExampleSentenceProseBlock",
  labels: { singular: "Example sentence", plural: "Example sentences" },
  fields: [
    {
      name: "japanese",
      type: "richText",
      required: true,
      editor: sentenceEditor,
      admin: {
        description:
          "The sentence. Use Ruby for a one-off reading and Term for a word from the catalogue.",
      },
    },
    { name: "romaji", type: "text" },
    { name: "english", type: "text" },
    audioField({ description: "Someone reading the sentence aloud." }),
  ],
};

/** Block-level blocks, exported for the snapshot walker as well as the editor. */
export const PROSE_BLOCKS: Block[] = [Callout, ExampleSentence];

/*
 * ── Media in prose is the upload node, not a block ───────────────────────────
 *
 * The plan listed a third block-level block, `mediaFigure`. It is not here, and
 * `UploadFeature` covers it instead: an upload node already picks a file from
 * the `media` collection, and giving it a `caption` field is all a figure is.
 * A separate block would have been a second way to put an image in a paragraph,
 * with the toolbar button pointing at the other one — the kind of duplication
 * this rework is removing. `mediaFigure` still arrives in Phase 4a as a lesson
 * block, where it is the only thing on the screen rather than something inside
 * a sentence.
 *
 * One node covers image, audio and video because the converter switches on the
 * file's `mimeType`. The `filterOptions` constraint that `payload/fields/media.ts`
 * puts on a real `upload` field has no equivalent here, so the picker will show
 * every file — which is a reason for the converter to handle all three rather
 * than assume an image and render a broken one.
 */
export const proseEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    /*
     * `defaultFeatures` already includes InlineToolbarFeature, so it is not
     * re-added here — the plan listed it before this was checked.
     *
     * Two defaults are replaced rather than kept:
     *
     *  - `UploadFeature`, to add the caption that makes an upload a figure.
     *  - `RelationshipFeature`, restricted to nothing. A bare relationship node
     *    would let an author drop a raw pointer to a term into a sentence, and
     *    it has no renderer — `termRef` is the designed way, with a display
     *    choice and the audio toggle. Two ways to reference a word, one of
     *    which silently renders nothing, is exactly the unusable-CMS feel being
     *    removed. It is disabled rather than dropped so that a relationship
     *    node in existing content still deserializes instead of throwing.
     */
    ...defaultFeatures.filter(
      (feature) => !["upload", "relationship"].includes(feature.key)
    ),
    UploadFeature({
      collections: {
        media: {
          fields: [
            {
              name: "caption",
              type: "text",
              admin: {
                description:
                  "Shown under the file. Leave empty for a bare image. This is the caption, " +
                  "not the alt text — alt text lives on the file itself and follows it everywhere.",
              },
            },
          ],
        },
      },
    }),
    RelationshipFeature({ enabledCollections: [] }),
    FixedToolbarFeature(),
    BlocksFeature({ blocks: PROSE_BLOCKS, inlineBlocks: PROSE_INLINE_BLOCKS }),
  ],
});
