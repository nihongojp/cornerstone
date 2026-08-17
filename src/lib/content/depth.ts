/*
 * How deep a lesson read populates. One number, two call sites, on purpose.
 *
 * There are two paths that load a lesson and they must agree:
 *
 *  - the public one, `payload.find` in `content.ts` (server)
 *  - the CMS Live Preview one, `useLivePreview` in `pages-client/preview/*`
 *    (browser)
 *
 * If they disagree, media renders in one and silently vanishes in the other —
 * an unpopulated `upload` arrives as a bare id, `mediaSrc` returns undefined,
 * and nothing logs anything. A shared constant makes that a fact of the code
 * rather than a comment in two files asking to be kept in sync.
 *
 * Not `server-only`: the preview wrappers are client components.
 *
 * Raise this when a new relationship adds a hop. Today the longest chain is
 * block → media (1). Phase 2's block → term → media is 2, and a `termRef`
 * inside rich text inside a block will be 3.
 */
export const LESSON_DEPTH = 1;

/**
 * Which Media fields come back. Without this every Media document arrives
 * whole — `prefix`, `focalX`, `updatedAt`, every generated size — and all of it
 * lands in the cached lesson entry. This is what actually gets rendered from.
 *
 * Only used by the server read: `useLivePreview` takes a depth but not a
 * populate, so preview carries slightly fatter Media documents. That costs
 * nothing — it is one editor, uncached.
 */
export const MEDIA_POPULATE = {
  media: {
    alt: true,
    url: true,
    filename: true,
    mimeType: true,
    width: true,
    height: true,
    sizes: true,
  },
} as const;
