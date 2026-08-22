/*
 * How deep a content read populates. One number, every call site, on purpose.
 *
 * There are two paths that load content and they must agree:
 *
 *  - the public one, `payload.find` in `content.ts` (server)
 *  - the CMS Live Preview one, `useLivePreview` in the colocated
 *    `ResourcesPreview` / `features/learning/components/preview/LessonPreview`
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
   * What a term renders from: the written forms and reading a `termRef` shows,
   * the audio the `showAudio` toggle plays, and the picture and stroke-order
   * diagram the lesson blocks use. Depth 2 would otherwise pull whole term
   * documents — notes, tags, JLPT level — through `unstable_cache` for a word
   * appearing in one sentence.
   *
   * **Adding a field a term is rendered from means adding it here as well**, and
   * the failure if you forget is the usual silent one: the field is simply
   * absent. That is not hypothetical. `image`, `strokes` and `strokeOrder` were
   * missing from this list from Phase 4a until 4b, so `termImage` returned
   * undefined for all four terms that have a picture and every `vocabList` grid
   * and `listenAndChoose` rendered "Image soon" instead — with nothing failing
   * anywhere. It surfaced only when the stroke-order spotlight was authored as a
   * block and its diagram did not appear either.
   *
   * `npm run content:verify` reads at this exact populate, which is what makes it
   * the deterministic check — and also why it cannot catch an omission *here*:
   * a field this list does not request is a field it never sees. Adding one is
   * the moment to look at the screen.
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
    image: true,
    strokes: true,
    strokeOrder: true,
  },
} as const;
