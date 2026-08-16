import type { CollectionConfig } from "payload";

/*
 * Uploads. Backed by Vercel Blob (#12) — see the storage plugin in
 * `src/payload.config.ts`. Without `BLOB_READ_WRITE_TOKEN` the adapter falls
 * back to local disk, which is fine for development and useless on Vercel.
 *
 * Note what this collection is NOT: components do not hold `upload`
 * relationships to it. The existing Cloudinary URLs are grandfathered and the
 * import carries them across verbatim, so every component media field is a
 * plain URL string. Upload here, copy the URL, paste it into the component.
 * Wiring components to real upload relationships is a later cleanup, once the
 * Cloudinary assets have been migrated across.
 */
export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Media", plural: "Media" },
  admin: {
    group: "Content",
    description:
      "Images, audio and video uploaded here. Copy a file's URL into the media field of " +
      "whichever component needs it.",
  },
  access: { read: () => true },
  upload: {
    mimeTypes: ["image/*", "audio/*", "video/*"],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      admin: {
        description:
          "What the image shows, for screen readers. Required for images; leave empty for " +
          "audio and video.",
      },
    },
    {
      name: "caption",
      type: "text",
      admin: { description: "Optional visible caption." },
    },
  ],
};
