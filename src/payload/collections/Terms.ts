import type { CollectionConfig } from "payload";

import { audioField, imageField } from "../fields/media";
import { isAdmin } from "../access/isAdmin";
import { guardTermDelete } from "../hooks/guardReferencedDelete";
// Safe as a static import: `utils/kana.ts` is a pure lookup table with no
// imports of its own, so it does not drag anything into the Payload CLI paths
// (unlike `@/lib/auth`, which is why Media.ts defers its import to request time).
import { kanaToRomaji } from "../../utils/kana";
import { revalidateTerm, revalidateTermDelete } from "../hooks/revalidate";

/*
 * Vocabulary: every word, phrase, kana and kanji the lessons teach, authored
 * once and referenced from wherever it is used.
 *
 * The content this was seeded from had no such thing, and the cost was visible
 * in the data: 133 term-like strings across the five lessons collapse to 41
 * terms, because the same phrase is retyped into five different blocks
 * (`termsPage`, `matchingExercise`, `matchAudioExercise`,
 * `pronunciationExercise`, `dragAndDropPuzzle`). Nothing tied those five copies
 * together, so:
 *
 *  - Audio and images were attached to whichever copy the author happened to
 *    be editing, and `utils/termMedia.ts` then guessed at runtime which other
 *    copies meant the same word — matching on a fuzzy key that collapses
 *    doubled letters, because `Konnnichiwa` and `Konnichiwa` are both in the
 *    content and are the same word.
 *  - A typo in one copy silently became a different word.
 *  - Kana pairs were encoded as "あ/ア" and split on the slash in four separate
 *    places. The delimiter *was* the schema.
 *
 * ── One collection, not three ────────────────────────────────────────────────
 *
 * `kind` discriminates kana / kanji / vocab / phrase rather than splitting into
 * separate collections. They share almost every field, every block that
 * references one could reference any of them, and three collections would mean
 * three relationship targets on every field that points here. `admin.condition`
 * hides what does not apply, so a kana entry does not show a JLPT dropdown.
 *
 * ── `japanese` is optional on purpose ────────────────────────────────────────
 *
 * Every phrase in the imported content is romaji — "Hajimemashite", not
 * はじめまして. The Japanese script was never authored. Requiring it here would
 * have meant either refusing to seed the catalogue or inventing the script, so
 * instead it is required for kana and kanji (where the character *is* the
 * entry) and optional elsewhere, and `npm run content:derive-terms` reports how
 * many entries still lack it. That number is a real editorial backlog, not a
 * schema failure.
 */

const KIND_NEEDS_JAPANESE = ["kana", "kanji"];

export const Terms: CollectionConfig = {
  slug: "terms",
  labels: { singular: "Term", plural: "Vocabulary" },
  admin: {
    useAsTitle: "display",
    defaultColumns: ["display", "kind", "reading", "meaning", "jlpt", "updatedAt"],
    group: "Vocabulary",
    listSearchableFields: ["japanese", "reading", "romaji", "meaning", "key"],
    description:
      "Words, phrases, kana and kanji. Author a term once here and reference it from lessons — " +
      "its audio, image and readings then follow it everywhere.",
  },
  /*
   * No `versions: { drafts: true }`, unlike the lesson-shaped collections and
   * for the same reason as Media: a term is referenced data, not a page.
   *
   * A draft term inside a published lesson has no good answer. Filter drafts out
   * of the read and the relationship populates to null — the lesson renders with
   * the word's audio, reading and image silently missing. Leave them in and an
   * unpublished term is on the site anyway, which is what a draft is supposed to
   * prevent. The failure is silent either way, and it is the same shape as the
   * one that made drafts wrong on Media.
   *
   * So a term is in the catalogue or it is not, and edits are immediate. If
   * drafting vocabulary turns out to matter, the honest version is a `status`
   * field the lesson read filters on explicitly, not Payload's version machinery.
   */
  /*
   * `read` is open because a term is rendered inside every lesson that
   * references it, and unlike Media there are no bytes behind it to gate — the
   * audio and images it points at are `media` documents with their own rules.
   *
   * Delete is not open: a term is referenced by `termRef` nodes inside lesson
   * prose, and deleting one leaves those nodes resolving to nothing. That is
   * the same silent-blank failure the collection comment above is organised
   * around, arrived at from the other end.
   */
  access: { read: () => true, delete: isAdmin },
  defaultSort: "key",
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description:
          "Stable identifier, lowercase. Seeding and re-import match on this, so changing it " +
          "creates a new term rather than renaming one.",
      },
    },
    {
      name: "kind",
      type: "select",
      required: true,
      index: true,
      defaultValue: "vocab",
      options: [
        { label: "Vocabulary word", value: "vocab" },
        { label: "Phrase or pattern", value: "phrase" },
        { label: "Kana character", value: "kana" },
        { label: "Kanji character", value: "kanji" },
      ],
      admin: { position: "sidebar" },
    },
    {
      /*
       * Computed, not authored — see the beforeChange hook. It exists so
       * `useAsTitle` and the relationship picker show something a human can
       * recognise; without it every reference field lists document ids.
       */
      name: "display",
      type: "text",
      admin: {
        readOnly: true,
        position: "sidebar",
        description: "How this term is labelled in lists and pickers. Derived from the fields below.",
      },
    },
    {
      name: "japanese",
      type: "text",
      admin: {
        description:
          "The written form — 初めまして, あ, 食べる. Required for kana and kanji. Much of the " +
          "imported catalogue has only romaji so far; filling this in is the backlog.",
      },
      validate: (value: unknown, { data }: { data?: { kind?: string | null } }) => {
        const needs = KIND_NEEDS_JAPANESE.includes(String(data?.kind ?? ""));
        if (!needs || (typeof value === "string" && value.trim())) return true;
        return "Required for kana and kanji — the character is the entry.";
      },
    },
    {
      name: "katakana",
      type: "text",
      admin: {
        condition: (_, siblingData) => siblingData?.kind === "kana",
        description:
          "The katakana counterpart. This is what the old \"あ/ア\" strings encoded with a slash; " +
          "how the pair is displayed is now the renderer's decision, not the data's.",
      },
    },
    {
      name: "reading",
      type: "text",
      admin: {
        condition: (_, siblingData) => siblingData?.kind !== "kana",
        description: "Kana reading of the written form — はじめまして.",
      },
    },
    {
      name: "romaji",
      type: "text",
      admin: {
        description:
          "Filled in automatically from the reading when left empty. Set it by hand to override.",
      },
    },
    {
      name: "furigana",
      type: "array",
      labels: { singular: "Segment", plural: "Furigana" },
      admin: {
        condition: (_, siblingData) => siblingData?.kind !== "kana",
        description:
          "The written form split into segments, each with its reading. Leave a segment's reading " +
          "empty for okurigana and other parts that take no ruby: 食(た)+べる is two segments.",
        initCollapsed: true,
      },
      fields: [
        { name: "base", type: "text", required: true, admin: { description: "The characters." } },
        { name: "ruby", type: "text", admin: { description: "Their reading, or empty for none." } },
      ],
    },
    {
      name: "meaning",
      type: "text",
      admin: { description: "English gloss." },
    },
    {
      name: "partOfSpeech",
      type: "select",
      admin: { condition: (_, siblingData) => ["vocab", "phrase"].includes(siblingData?.kind) },
      options: [
        { label: "Noun", value: "noun" },
        { label: "Verb", value: "verb" },
        { label: "Adjective", value: "adjective" },
        { label: "Adverb", value: "adverb" },
        { label: "Particle", value: "particle" },
        { label: "Expression", value: "expression" },
      ],
    },
    {
      name: "jlpt",
      type: "select",
      admin: {
        condition: (_, siblingData) => siblingData?.kind !== "kana",
        position: "sidebar",
      },
      options: ["N5", "N4", "N3", "N2", "N1"].map((v) => ({ label: v, value: v })),
    },
    {
      name: "strokes",
      type: "number",
      admin: {
        condition: (_, siblingData) => ["kana", "kanji"].includes(siblingData?.kind),
        step: 1,
      },
    },
    imageField({
      name: "strokeOrder",
      label: "Stroke order",
      description:
        "Stroke-order diagram. Replaces src/data/kanaStrokeOrder.ts, which hardcoded ten of these " +
        "as media URLs in a TypeScript constant kept in sync with a migration script by hand.",
    }),
    audioField({ description: "Pronunciation. Referencing blocks read it from here." }),
    imageField({ description: "A picture of the thing, for image-choice exercises." }),
    {
      name: "tags",
      type: "text",
      hasMany: true,
      admin: { position: "sidebar" },
    },
    {
      name: "notes",
      type: "richText",
      admin: {
        description:
          "Usage notes for the learner — when to use this word and when not to. " +
          "Reference other terms inline rather than retyping them.",
      },
    },
  ],
  hooks: {
    beforeDelete: [guardTermDelete],
    afterChange: [revalidateTerm],
    afterDelete: [revalidateTermDelete],
    beforeChange: [
      ({ data }) => {
        /*
         * `romaji` from `reading` via the same transliterator the player uses.
         * It is stored rather than computed at render because the player
         * currently converts kana tiles to romaji on the fly, which means the
         * same stored data produces two different exercises depending on a flag.
         * Storing it makes the value a fact about the term.
         */
        if (!data.romaji && typeof data.reading === "string" && data.reading.trim()) {
          data.romaji = kanaToRomaji(data.reading);
        }

        const label = data.japanese || data.reading || data.romaji || data.key || "";
        data.display = data.meaning ? `${label} — ${data.meaning}` : label;
        return data;
      },
    ],
  },
};
