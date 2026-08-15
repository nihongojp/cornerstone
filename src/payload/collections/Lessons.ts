import type { CollectionConfig } from "payload";

import { grammarBlocks } from "../blocks/grammar";
import { escapeHatchBlocks, legacyBlocks } from "../blocks/legacy";

/*
 * One `lessons` collection replaces both Mongo collections — legacy `lessons`
 * (prefecture/hiragana) and `newlessons` (grammar). The display field is
 * `title`; `newlessons` called it `lesson`, and the rename happens at import.
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

const AUTHORING_CONVENTION =
  "Convention: one component per exercise. The player renders an exercise as a single screen " +
  "and there is no composite renderer yet, so a second block in the same exercise will not " +
  "show. Add another exercise instead.";

export const Lessons: CollectionConfig = {
  slug: "lessons",
  labels: { singular: "Lesson", plural: "Lessons" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "course", "order", "slug", "_status", "updatedAt"],
    group: "Content",
    listSearchableFields: ["title", "slug", "cardTitle"],
    description: "Every lesson, from both of the old lesson systems.",
  },
  access: { read: () => true },
  defaultSort: "order",
  // Replaces the old `isActive` flag: unpublished lessons are drafts.
  versions: { drafts: true },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: { description: 'The lesson name, e.g. "Lesson 1 V1". Stored as `lesson` in the old grammar data.' },
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
      admin: { description: "Heading shown on the lessons list card. Falls back to the title." },
    },
    {
      name: "shuffleExercises",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Shuffle exercises within each generated group when the lesson is rendered. " +
          "Turn off for lessons where the order teaches something.",
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
            description: "Optional name, for your own navigation. Not shown to learners.",
          },
        },
        {
          name: "components",
          type: "blocks",
          required: true,
          minRows: 1,
          maxRows: 1,
          blocks: [...grammarBlocks, ...legacyBlocks, ...escapeHatchBlocks],
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
        description: 'Content revision label carried over from the old data, e.g. "v1".',
      },
    },
    {
      name: "funFact",
      type: "textarea",
      admin: { description: "Shown at the end of the lesson." },
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Learner-facing notes." },
    },
    {
      name: "achievement",
      type: "group",
      admin: { description: "Awarded on completion. Leave the title empty for no award." },
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
