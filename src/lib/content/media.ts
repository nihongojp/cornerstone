import type { Media } from "../../payload/payload-types";

/*
 * Reading an `upload` relationship, on either side of the wire.
 *
 * Deliberately not `server-only`. `adapters.ts` imports this and runs in the
 * browser: the CMS Live Preview wrappers re-run the adapters on the document
 * `useLivePreview` streams in, so anything the adapters touch has to work in
 * both places. Keep this file free of imports that do not.
 *
 * ── Absence is the signal ───────────────────────────────────────────────────
 *
 * An unfilled media slot used to be a string containing "PLACEHOLDER", tested
 * for by seven near-copies of an `isPlaceholderUrl` helper that disagreed with
 * each other. Now it is a relationship that is not set, and `resolveMedia`
 * returns null for it — along with the two other ways nothing useful arrives:
 *
 *  - `null` / `undefined`: no file chosen.
 *  - a bare number: the id came back unpopulated because the read did not ask
 *    for enough `depth`. Rendering an id is never right, and this is the most
 *    likely way media breaks from here on, so it is worth knowing that
 *    `resolveMedia` returning null can mean "depth too shallow" as well as
 *    "nothing chosen". `content.ts` and the three preview wrappers set depth;
 *    if images vanish in one place and not another, that is where to look.
 */

/** The populated Media document, or null when there is nothing to render. */
export function resolveMedia(value: Media | number | null | undefined): Media | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return null;
  return value;
}

export type MediaSize = "thumbnail" | "card" | "wide";

type Rendered = {
  src: string;
  alt: string;
  width: number | undefined;
  height: number | undefined;
};

/**
 * What an `<img>` needs, at the requested size when one exists.
 *
 * Sizes are generated at upload, so every file that predates `imageSizes` —
 * the whole Cloudinary back catalogue — has none and falls back to the
 * original. That fallback is permanent, not a migration step: audio and video
 * never have sizes either.
 */
export function renderableImage(
  value: Media | number | null | undefined,
  size?: MediaSize
): Rendered | null {
  const media = resolveMedia(value);
  if (!media) return null;

  const variant = size ? media.sizes?.[size] : undefined;
  const src = variant?.url ?? media.url;
  if (!src) return null;

  return {
    src,
    // Empty rather than absent: an image with no alt text is decorative to a
    // screen reader, which is the right reading of "the author left it blank".
    alt: media.alt ?? "",
    width: variant?.width ?? media.width ?? undefined,
    height: variant?.height ?? media.height ?? undefined,
  };
}

/**
 * The playable URL for an upload, or undefined.
 *
 * `undefined` rather than `null` to match the optional-field convention the
 * player contract uses — this is what `optText` returned for an empty media
 * string, and every consumer already treats absence that way.
 */
export function mediaSrc(value: Media | number | null | undefined): string | undefined {
  return resolveMedia(value)?.url ?? undefined;
}
