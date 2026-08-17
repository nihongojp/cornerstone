import type { Access, CollectionConfig } from "payload";

import { isAdmin } from "../access/isAdmin";

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
 * Components hold real `upload` relationships to this collection — see
 * `payload/fields/media.ts`. They used to hold URL strings copied out of the
 * admin by hand; that is what made a missing asset a string convention
 * ("PLACEHOLDER_AUDIO_URL") rather than an absent row, and what let a file be
 * renamed out from under six blocks at once.
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
/*
 * `isReadingStaticFile` splits the two questions this gate used to answer with
 * one word.
 *
 * Payload sets it only in `uploads/checkFileAccess.js`, the handler behind
 * `/api/media/file/<filename>` — the bytes. Everywhere else it is false,
 * including when Payload populates an `upload` relationship while reading a
 * lesson. Before this distinction existed the gate said "no" to both, which was
 * survivable while components held URL strings and nothing was ever populated.
 * With real relationships it is not: `content.ts` reads with
 * `overrideAccess: false`, the populate runs against a request carrying no
 * learner cookie, and every populated upload comes back as `null`. Silently —
 * no error, no log, just a lesson with no images.
 *
 * So: metadata is public, bytes are not. Someone unauthenticated can learn that
 * a file called `arigato.png` exists, is 856×623, and has alt text. They still
 * cannot fetch a pixel of it — the URL in that metadata is this same gated
 * route, and it 403s. That is the right trade; the value was always in the
 * bytes. The alternative, flipping `content.ts` to `overrideAccess: true`, is a
 * much bigger hammer that also drops the published-only filter those reads lean
 * on.
 *
 * ── Settled, 2026-08-17: do not tighten this ────────────────────────────────
 *
 * The exposure was measured and put to Justin, who accepted it. `/api/media`
 * returns 200 anonymously with all 33 documents; `/api/media/file/*` 403s,
 * verified on both an image and an audio file. What that leaks is a content
 * inventory — the filenames are romaji greetings, so which words still lack a
 * recording is publicly derivable — and nothing else.
 *
 * This reads like an oversight to anyone arriving at it fresh, especially while
 * doing access-control work, and "fixing" it returns `null` for every populated
 * upload with no error anywhere: measured 55 vs 0 on one lesson. If you think
 * this rule is too loose, re-read the paragraph above before changing it.
 *
 * Still open, and genuinely worth doing: no file has `imageSizes` variants yet,
 * so "variants are gated too" is untested. Check that `sizes.*.url` resolves to
 * `/api/media/file/*` the first time a file goes through the upload pipeline.
 */
const readMedia: Access = async ({ req, isReadingStaticFile }) => {
  if (!isReadingStaticFile) {
    return true;
  }

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
    // Without `useAsTitle` every row in the list and every entry in an upload
    // picker renders as a bare document id, which makes choosing a file a
    // guessing game.
    useAsTitle: "filename",
    defaultColumns: ["filename", "alt", "mimeType", "filesize", "updatedAt"],
    /*
     * Without this the list search box filters on `filename` alone, which is
     * the one field nobody remembers — the catalogue arrived from Cloudinary
     * with names like `Screenshot_2026-08-14_at_11-42-03.png`. Searching what
     * an image *shows* means searching `alt` and `caption`.
     */
    listSearchableFields: ["filename", "alt", "caption"],
    description:
      "Images, audio and video. Upload once here, then pick the file from the media field " +
      "of whichever component needs it.",
  },
  /*
   * Delete is the one operation here with no undo anywhere: the row goes, and
   * the blob goes with it. Every component holding that upload then renders
   * nothing, across however many lessons referenced it.
   */
  access: { read: readMedia, delete: isAdmin },
  upload: {
    mimeTypes: ["image/*", "audio/*", "video/*"],
    /*
     * Sizes are generated at upload time, so everything already in the store
     * has none — the whole Cloudinary back catalogue included. Consumers must
     * fall back to the original; `resolveMedia` in `lib/content/media.ts` does.
     *
     * These reach the private Blob store without any change to
     * `storage/vercelPrivateBlob.ts`: the cloud-storage plugin's
     * `getIncomingFiles` already iterates `req.payloadUploadSizes` and uploads
     * each variant through the same `handleUpload`.
     */
    imageSizes: [
      { name: "thumbnail", width: 400, height: 300, position: "centre" },
      { name: "card", width: 768 },
      { name: "wide", width: 1600 },
    ],
    // Works because admins are `req.user`, which passes the bytes gate above.
    adminThumbnail: "thumbnail",
    focalPoint: true,
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
      /*
       * Not `required: true`: that would demand alt text for every audio clip
       * and video too, where it means nothing. The rule is "required for
       * images", so it is expressed as a rule rather than as a description
       * asking politely — which is what it was, and roughly half the catalogue
       * has an empty alt as a result.
       */
      validate: (value: unknown, { data }: { data?: { mimeType?: string | null } }) => {
        const isImage = String(data?.mimeType ?? "").startsWith("image/");
        if (!isImage || (typeof value === "string" && value.trim())) return true;
        return "Alt text is required for images.";
      },
    },
    {
      name: "caption",
      type: "text",
      admin: { description: "Optional visible caption." },
    },
  ],
};
