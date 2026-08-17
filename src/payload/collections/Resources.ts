import type { CollectionConfig } from "payload";

import {
  revalidateResources,
  revalidateResourcesDelete,
} from "../hooks/revalidate";
import { generatePreviewURL } from "../preview";
import { readPublishedOrEditor } from "../access/readPublished";

/*
 * The /resources page: a handful of named groups, each a list of links.
 *
 * The zod schema types the items as `unknown[]` because the source stored them
 * as an opaque JSON blob, but the page that renders them reads a fixed shape
 * (`{ id, title, url, description }`), so they are modelled as real fields.
 * `id` is spelled `itemId` — Payload owns `id` on every row.
 */
export const Resources: CollectionConfig = {
  slug: "resources",
  versions: { drafts: true },
  labels: { singular: "Resource group", plural: "Resource groups" },
  admin: {
    useAsTitle: "category",
    defaultColumns: ["category", "_status", "updatedAt"],
    group: "Content",
    description:
      "Link collections shown on the Resources page, grouped by category.",
    // Every group shares one page, so this opens /resources rather than a page
    // belonging to this document.
    preview: generatePreviewURL("resources"),
  },
  access: { read: readPublishedOrEditor },
  hooks: {
    afterChange: [revalidateResources],
    afterDelete: [revalidateResourcesDelete],
  },
  fields: [
    {
      name: "category",
      type: "text",
      required: true,
      admin: { description: "The section heading on the Resources page." },
    },
    {
      name: "items",
      type: "array",
      labels: { singular: "Link", plural: "Links" },
      admin: { description: "Shown in this order." },
      fields: [
        {
          name: "itemId",
          type: "text",
          required: true,
          admin: {
            description:
              "Stable key for this link, unique within the group. Used as the React key.",
          },
        },
        { name: "title", type: "text", required: true },
        {
          name: "url",
          type: "text",
          admin: {
            description:
              'Absolute URL. Opens in a new tab. Optional on purpose: an entry with a title and description but no link yet is a real state the site already handles — it renders as "(No URL)" — and it keeps a planned resource visible as a to-do instead of losing the note.',
          },
        },
        { name: "description", type: "richText" },
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
          "The MongoDB `_id` this group was imported from. Used to make re-imports idempotent.",
      },
    },
  ],
};
