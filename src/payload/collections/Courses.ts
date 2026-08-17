import type { CollectionConfig } from "payload";

import { revalidateCourse, revalidateCourseDelete } from "../hooks/revalidate";
import { readPublishedOrEditor } from "../access/readPublished";

/*
 * A course is an ordered track of lessons. It replaces the old `nextSlug`
 * linked list: "what comes next" is now `course` + `lessons.order`, which an
 * editor can reorder without rewriting a chain of pointers.
 */
export const Courses: CollectionConfig = {
  slug: "courses",
  versions: { drafts: true },
  labels: { singular: "Course", plural: "Courses" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "trackType", "slug", "updatedAt"],
    group: "Content",
    description: "Tracks that group lessons into an ordered sequence.",
  },
  access: { read: readPublishedOrEditor },
  hooks: {
    afterChange: [revalidateCourse],
    afterDelete: [revalidateCourseDelete],
  },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description:
          "URL segment. Lowercase, hyphenated. Changing it breaks existing links.",
      },
    },
    {
      name: "trackType",
      type: "select",
      required: true,
      defaultValue: "beginner-to-intermediate",
      options: [
        {
          label: "Beginner to intermediate",
          value: "beginner-to-intermediate",
        },
        { label: "2-week crash course", value: "2-week-crash-course" },
      ],
      admin: {
        position: "sidebar",
        description:
          "What kind of track this is. Adding a new type needs a code change plus a database " +
          "migration — ask an engineer rather than reusing an ill-fitting one.",
      },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Shown on the course card. A sentence or two." },
    },
    {
      name: "lessons",
      type: "join",
      collection: "lessons",
      on: "course",
      admin: {
        description:
          "Every lesson pointing at this course, read-only here. Sequence comes from each " +
          "lesson's Order field — set it on the lesson, not here.",
      },
    },
  ],
};
