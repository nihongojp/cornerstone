import type { CollectionConfig } from "payload";

import { libraryBlocks } from "../blocks/library";
import { guardLessonDelete } from "../hooks/guardLessonDelete";
import { revalidateLesson, revalidateLessonDelete } from "../hooks/revalidate";
import { generatePreviewURL } from "../preview";
import { readPublishedOrEditor } from "../access/readPublished";

/*
 * One `lessons` collection replaces both Mongo collections — legacy `lessons`
 * (prefecture/hiragana) and `newlessons` (grammar). The display field is
 * `title`; `newlessons` called it `lesson`, and the rename happens at import.
 *
 * `format` is what survives of that split. The two players are two different
 * renderers on two URL families, so which one a lesson belongs to has to be
 * stated rather than guessed — deriving it from the course would weld product
 * structure to rendering, and deriving it from the blocks present would make
 * every list query load every lesson's exercises (#20).
 *
 * Shape: lesson → `exercises` (ordered array) → `components` (blocks).
 * `exercises` is an array field rather than its own collection on purpose — an
 * exercise belongs to exactly one lesson, is order-sensitive, and has no
 * independent lifecycle.
 *
 * Not modelled, deliberately:
 *  - `nextSlug` — course + order replaces the linked list (#27, #18).
 *  - `checkpointPool` — derived at render from the terms introduced earlier in
 *    the lesson, never stored (#27).
 *  - `isActive` — Payload's draft/publish status replaces it.
 *  - item `number` — unreliable in the source data; array position is the order.
 */

/*
 * An exercise is one screen, and a screen is an ordered list of blocks.
 *
 * That is the change that makes this a CMS rather than a transcription: the
 * `maxRows: 1` that used to be on `components` meant a screen could only ever be
 * one block, so every new layout needed a developer. It is gone.
 *
 * The seventeen blocks this replaced — one per legacy JSON shape, split into
 * "Grammar lesson" and "Legacy lesson" groups because the two families could not
 * mix — were deleted in Phase 4b along with the flattening layer that fed them
 * to two separate players. There is one library and one runner.
 */
const AUTHORING_CONVENTION =
  "One exercise is one screen. Blocks from Content and Practice compose onto that screen in " +
  "order — a prose introduction followed by the exercise it sets up is one screen, not two.";

export const Lessons: CollectionConfig = {
  slug: "lessons",
  labels: { singular: "Lesson", plural: "Lessons" },
  admin: {
    useAsTitle: "title",
    defaultColumns: [
      "title",
      "course",
      "order",
      "slug",
      "_status",
      "updatedAt",
    ],
    group: "Content",
    listSearchableFields: ["title", "slug", "cardTitle"],
    description: "Every lesson, from both of the old lesson systems.",
    // Opens the lesson in its own tab, in whichever player `format` selects.
    // The Live Preview panel is the same destination, side by side instead.
    preview: generatePreviewURL("lessons"),
  },
  access: { read: readPublishedOrEditor },
  hooks: {
    beforeDelete: [guardLessonDelete],
    afterChange: [revalidateLesson],
    afterDelete: [revalidateLessonDelete],
  },
  defaultSort: "order",
  // Replaces the old `isActive` flag: unpublished lessons are drafts.
  versions: { drafts: true },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: {
        description:
          'The lesson name, e.g. "Lesson 1 V1". Stored as `lesson` in the old grammar data.',
      },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description:
          "URL segment and the key learner progress is recorded against. A database foreign " +
          "key cascades renames into existing progress rows, but bookmarked lesson URLs still " +
          "break — rename rarely.",
      },
    },
    {
      name: "format",
      type: "select",
      required: true,
      index: true,
      defaultValue: "step",
      options: [
        { label: "Step-through lesson (grammar player)", value: "step" },
        { label: "Flashcard lesson (prefecture player)", value: "flashcard" },
      ],
      admin: {
        position: "sidebar",
        description:
          "Which player renders this lesson, and which list it appears in. Step-through lessons " +
          "play one component per screen at /newlesson/<slug>; flashcard lessons open with a deck " +
          "and then run their exercises at /lesson/<slug>, and are the only ones pinned to the " +
          "dashboard map. Pick the family your components come from — mixing families in one " +
          "lesson will not render.",
      },
    },
    {
      name: "course",
      type: "relationship",
      relationTo: "courses",
      admin: {
        position: "sidebar",
        description: "Which track this lesson belongs to.",
      },
    },
    {
      name: "order",
      type: "number",
      admin: {
        position: "sidebar",
        step: 1,
        description:
          "Position within the course, ascending. This is what decides which lesson comes next.",
      },
    },
    {
      name: "cardTitle",
      type: "text",
      admin: {
        description:
          "Heading shown on the lessons list card. Falls back to the title.",
      },
    },
    {
      name: "shuffleExercises",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Vary the order of consecutive practice screens of the same kind, so a learner " +
          "repeating the lesson does not get the same sequence. Screens that present " +
          "material never move, and a run never moves out of its place in the lesson. " +
          "Turn off where the order within a run teaches something.",
      },
    },
    {
      name: "exercises",
      type: "array",
      labels: { singular: "Exercise", plural: "Exercises" },
      admin: {
        initCollapsed: true,
        description: `Ordered — drag to resequence. ${AUTHORING_CONVENTION}`,
      },
      fields: [
        {
          name: "label",
          type: "text",
          admin: {
            description:
              "Optional name, for your own navigation. Not shown to learners.",
          },
        },
        {
          name: "components",
          type: "blocks",
          required: true,
          minRows: 1,
          // `maxRows: 1` was here. Removing it is what turns a screen into an
          // ordered block list — see the note on AUTHORING_CONVENTION above.
          blocks: libraryBlocks,
          admin: { description: AUTHORING_CONVENTION },
        },
      ],
    },
    // ── Metadata ────────────────────────────────────────────────────────────
    {
      name: "prefecture",
      type: "text",
      admin: {
        position: "sidebar",
        description:
          "Optional. Set it and the lesson pins to that prefecture on the dashboard map; " +
          "leave it empty for lessons that are not tied to a place.",
      },
    },
    {
      name: "tags",
      type: "text",
      hasMany: true,
      admin: { position: "sidebar" },
    },
    {
      name: "version",
      type: "text",
      admin: {
        position: "sidebar",
        description:
          'Content revision label carried over from the old data, e.g. "v1".',
      },
    },
    {
      name: "funFact",
      type: "richText",
      admin: { description: "Shown at the end of the lesson." },
    },
    {
      name: "notes",
      type: "richText",
      admin: { description: "Learner-facing notes." },
    },
    {
      name: "achievement",
      type: "group",
      admin: {
        description:
          "Awarded on completion. Leave the title empty for no award.",
      },
      fields: [
        { name: "title", type: "text" },
        { name: "xp", type: "number", admin: { step: 1 } },
      ],
    },
    {
      name: "sourceId",
      type: "text",
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        readOnly: true,
        description:
          "The MongoDB `_id` this lesson was imported from. Re-running the import matches on " +
          "it, and old `/lesson/<ObjectId>` links resolve through it. Do not edit or reuse.",
      },
    },
  ],
};
