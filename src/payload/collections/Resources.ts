import type { CollectionConfig } from "payload";

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
  labels: { singular: "Resource group", plural: "Resource groups" },
  admin: {
    useAsTitle: "category",
    defaultColumns: ["category", "_status", "updatedAt"],
    group: "Content",
    description: "Link collections shown on the Resources page, grouped by category.",
  },
  access: { read: () => true },
  versions: { drafts: true },
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
            description: "Stable key for this link, unique within the group. Used as the React key.",
          },
        },
        { name: "title", type: "text", required: true },
        {
          name: "url",
          type: "text",
          required: true,
          admin: { description: "Absolute URL. Opens in a new tab." },
        },
        { name: "description", type: "textarea" },
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
        description: "The MongoDB `_id` this group was imported from. Used to make re-imports idempotent.",
      },
    },
  ],
};
