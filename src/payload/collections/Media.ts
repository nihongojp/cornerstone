import type { Access, CollectionConfig } from "payload";

/*
 * Uploads. Backed by a **private** Vercel Blob store — see
 * `payload/storage/vercelPrivateBlob.ts`. Without `BLOB_READ_WRITE_TOKEN` the
 * adapter falls back to local disk, which is fine for development and useless
 * on Vercel.
 *
 * Private means the raw blob URL 401s to anyone without a token, so a file's
 * only route to a browser is `/api/media/file/<filename>` — this collection's
 * `read` below is the gate, and the adapter's `staticHandler` only redirects to
 * a short-lived signed URL once that gate has passed. Loosening `read` to
 * `() => true` would undo the whole arrangement.
 *
 * Note what this collection is NOT: components do not hold `upload`
 * relationships to it. Every component media field is a plain URL string, which
 * still works here because Payload stores `url` as that gated route rather than
 * a blob URL. Upload here, copy the URL, paste it into the component.
 * Real upload relationships are now unblocked — the Cloudinary back catalogue
 * has been migrated across — but deliberately not taken; that is its own piece
 * of work, not a prerequisite for anything.
 */

/*
 * Two identities can read media, and they live in different systems: Payload
 * `cms_admins` (the admin UI, authenticated by Payload's own cookie) and
 * learners (better-auth, `public.user`). Payload knows nothing about the
 * latter, so `req.user` is null for every student — gating on it alone would
 * serve the admin and 403 the entire app.
 *
 * The import is dynamic on purpose. `@/lib/auth` throws at module scope when
 * `BETTER_AUTH_SECRET` is missing, and opens a database pool besides; a static
 * import would drag all of that into anything that merely loads
 * `payload.config.ts` — `payload generate:types`, `payload migrate:create`, the
 * migrate scripts. Deferring it to request time keeps those paths clean.
 */
const readMedia: Access = async ({ req }) => {
  if (req.user) {
    return true;
  }

  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({ headers: req.headers });
    return Boolean(session?.user);
  } catch (err) {
    // Deny rather than throw: a failure here should read as "not authorised",
    // not as a 500 on every image in the lesson.
    req.payload.logger.error({ err, msg: "Media read access check failed" });
    return false;
  }
};
export const Media: CollectionConfig = {
  slug: "media",
  // No `versions: { drafts: true }` here, unlike the content collections. An
  // upload has no draft/publish cycle to model — a file is either in the store
  // or it is not — and turning it on needs a `_status` column plus a `_media_v`
  // table that the initial migration never created. With `push: false` nothing
  // creates them at boot, so the admin's Media list would query a column that
  // does not exist.
  labels: { singular: "Media", plural: "Media" },
  admin: {
    group: "Content",
    description:
      "Images, audio and video uploaded here. Copy a file's URL into the media field of " +
      "whichever component needs it.",
  },
  access: { read: readMedia },
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
