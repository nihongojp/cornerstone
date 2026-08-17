/*
 * How deep a content read populates. One number, every call site, on purpose.
 *
 * There are two paths that load content and they must agree:
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
 * ── Why 2 ───────────────────────────────────────────────────────────────────
 *
 * Two hops, set by the longest chain in the content:
 *
 *   lesson → block.audio                        (1)  an upload on a block
 *   lesson → block.content → termRef.term       (1)  a term referenced in prose
 *   lesson → block.content → termRef.term.audio (2)  that term's pronunciation
 *
 * A relationship inside a Lexical document costs a hop like any other, so the
 * `termRef` inline block added in Phase 3 is what moves this off 1. At depth 1
 * the term itself populates and its audio comes back as a bare id, so
 * `showAudio` renders no button — with nothing failing to say why. Phase 4's
 * `vocabList` block → term → media is the same two hops, so this already covers
 * it.
 *
 * ── Resources are no longer depth 0 ─────────────────────────────────────────
 *
 * They used to be: "resources link out by URL and hold no uploads" was true when
 * a link's description was a textarea. It is rich text now, which can hold an
 * image and a term reference, so the resources reads use this constant too. That
 * comment was accurate when written and became wrong without changing — the same
 * way `NewLessonPreview`'s "every media field on a block is a plain URL string"
 * did in Phase 1.
 */
export const CONTENT_DEPTH = 2;

/**
 * Which Media fields come back. Without this every Media document arrives
 * whole — `prefix`, `focalX`, `updatedAt`, every generated size — and all of it
 * lands in the cached lesson entry. This is what actually gets rendered from.
 *
 * Only used by the server read: `useLivePreview` takes a depth but not a
 * populate, so preview carries slightly fatter documents. That costs nothing —
 * it is one editor, uncached.
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
  /*
   * The fields a `termRef` renders from — `TermLike` in `lib/content/furigana.ts`
   * — plus the audio the `showAudio` toggle plays. Depth 2 would otherwise pull
   * whole term documents (notes, tags, JLPT level, stroke order) through
   * `unstable_cache` for a word appearing in one sentence.
   *
   * Adding a field to what `termRef` shows means adding it here as well, and the
   * failure if you forget is the usual silent one: the field is simply absent.
   * `npm run content:verify` reads at this exact populate for that reason.
   */
  terms: {
    key: true,
    japanese: true,
    katakana: true,
    reading: true,
    romaji: true,
    meaning: true,
    furigana: true,
    audio: true,
  },
} as const;
