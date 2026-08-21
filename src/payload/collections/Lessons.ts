import type { CollectionConfig } from "payload";

import { libraryBlocks } from "../blocks/library";
import { guardLessonDelete } from "../hooks/guardLessonDelete";
import { revalidateLesson, revalidateLessonDelete } from "../hooks/revalidate";
import { generatePreviewURL } from "../preview";
import { readPublishedOrEditor } from "../access/readPublished";
import { draftingVersions } from "../versions";
import { isAdmin } from "../access/isAdmin";
import { validateSlugFormat } from "../fields/slugFormat";

/*
 * One `lessons` collection replaces both Mongo collections — legacy `lessons`
 * (prefecture/hiragana) and `newlessons` (grammar). The display field is
 * `title`; `newlessons` called it `lesson`, and the rename happens at import.
 *
 * `format` is what survives of that split. The two players are two different
 * renderers on two URL families, so which one a lesson belongs to has to be
 * stated rather than guessed — deriving it from the course would weld product
 * structure to rendering, and deriving it from the blocks present would make
 * every list query load every lesson's steps (#20).
 *
 * Shape: course → lesson → `steps` (ordered array) → `components` (blocks),
 * and a block may reference `terms`. `steps` is an array field rather than its
 * own collection on purpose — a step belongs to exactly one lesson, is
 * order-sensitive, and has no independent lifecycle.
 *
 * Not modelled, deliberately:
 *  - `nextSlug` — course + order replaces the linked list (#27, #18).
 *  - `checkpointPool` — derived at render from the terms introduced earlier in
 *    the lesson, never stored (#27).
 *  - `isActive` — Payload's draft/publish status replaces it.
 *  - item `number` — unreliable in the source data; array position is the order.
 */

/*
 * A step is one screen, and a screen is an ordered list of blocks.
 *
 * It was called an `exercise` until the word became a liability: a step can be
 * pure prose with nothing to answer, so "exercise" promised a question that
 * half of them do not have. `step` is the word the rest of the stack already
 * uses — `user_progress.last_step`, `step_key`, the step-through player — so
 * one thing now has one name from the CMS through to the progress table.
 * Blocks are still what makes a step interactive; see `PRACTICE_BLOCK_SLUGS`.
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
  "One step is one screen. Blocks from Content and Practice compose onto that screen in " +
  "order — a prose introduction followed by the practice it sets up is one step, not two.";

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
  /*
   * `guardLessonDelete` already refuses to delete a lesson that learner
   * progress references, so this is the second of two locks rather than the
   * only one — but the first is about referential integrity and this one is
   * about authority, and a lesson nobody has started yet passes the first.
   */
  access: { read: readPublishedOrEditor, delete: isAdmin },
  hooks: {
    beforeDelete: [guardLessonDelete],
    afterChange: [revalidateLesson],
    afterDelete: [revalidateLessonDelete],
  },
  defaultSort: "order",
  // Replaces the old `isActive` flag: unpublished lessons are drafts.
  versions: draftingVersions,
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
      validate: validateSlugFormat,
      admin: {
        position: "sidebar",
        description:
          "URL segment and the key learner progress is recorded against. Canonical format: " +
          "<family>-l<level>-v<version>[-<variant>], e.g. \"grammar-l1-v1\" or " +
          "\"hiragana-l2-v1-akita\" (the variant only when family+level+version would " +
          "otherwise collide). A database foreign key cascades renames into existing progress " +
          "rows, but bookmarked lesson URLs still break — rename rarely.",
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
          "Which player renders this lesson, and which list it appears in. Both formats play at " +
          "/lessons/<slug> through the same runner; flashcard lessons are the ones pinned to the " +
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
    /*
     * `level` and `part` are what a learner is shown: the lessons list groups
     * every course's lessons into "Lesson <level>" sections and labels each
     * card "Lesson <level>.<part>".
     *
     * They were encoded in the slug (`grammar-l1-v2`) and recovered with
     * `/l(\d+)-v(\d+)/` in the list page — the schema living inside a string,
     * the same shape as the `"あ/ア"` slash-delimited kana this content model
     * already moved into real fields. `version` held the part number too, as
     * text ("v1"), so the number existed twice and neither copy was typed.
     *
     * `level` deliberately spans courses: "Lesson 1" is one section holding
     * both the grammar and the hiragana lesson, so it is not a position
     * within a course — `order` is that.
     */
    {
      name: "level",
      type: "number",
      required: true,
      index: true,
      admin: {
        position: "sidebar",
        step: 1,
        description:
          "Which numbered lesson this belongs to, across every course — the " +
          '"Lesson 3" heading on the lessons list. Not a position within a course; that is Order.',
      },
    },
    {
      name: "part",
      type: "number",
      required: true,
      defaultValue: 1,
      admin: {
        position: "sidebar",
        step: 1,
        description:
          'Which part of that lesson this is — shown as "Lesson 3.2". Start at 1; ' +
          "a lesson taught in one sitting just stays 1.",
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
      name: "shuffleSteps",
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
      name: "steps",
      type: "array",
      labels: { singular: "Step", plural: "Steps" },
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
          "it, and old `/lessons/<ObjectId>` links resolve through it. Do not edit or reuse.",
      },
    },
  ],
};
