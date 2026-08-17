/*
 * The library's block slugs, and deliberately nothing else.
 *
 * ── Why this is a separate file with no imports ──────────────────────────────
 *
 * `lib/content/adapters.ts` needs to know which blocks belong to the library, so
 * it can carry a run of them through to `RenderExercise` instead of flattening
 * them. And `adapters.ts` runs **in the browser** — the three Live Preview
 * wrappers are client components that re-run it on the document `useLivePreview`
 * streams in.
 *
 * Importing the block definitions there took the whole app down. `blocks/library.ts`
 * imports `fields/prose.ts` for `sentenceEditor`, which imports
 * `@payloadcms/richtext-lexical`, which reaches `payload/dist/utilities/dependencies/*`
 * and `import fs from 'fs'`. Next then tries to bundle Node builtins for the
 * browser and every route 500s with `Module not found: Can't resolve 'fs'` —
 * including `/admin`, which makes it look like a Payload problem rather than an
 * import problem.
 *
 * The plan's Rejected list says "putting `server-only` in anything `adapters.ts`
 * imports before Phase 4". This is the same rule from the other side: it is not
 * enough to avoid the `server-only` marker, the transitive graph has to stay
 * browser-safe. A list of strings is.
 *
 * ── Keeping it honest ───────────────────────────────────────────────────────
 *
 * A hand-maintained list is exactly the kind of second copy that drifts, so
 * `blocks/library.ts` asserts at module load that this list and the blocks it
 * actually registers are the same set. That check runs wherever the Payload
 * config is loaded — the dev server, every script, `payload:types` — so adding a
 * block and forgetting this file fails immediately and loudly rather than making
 * one screen quietly render nothing.
 */
export const LIBRARY_BLOCK_SLUGS = [
  // Content
  "prose",
  "dialogue",
  "videoLesson",
  "grammarPoint",
  "vocabList",
  "mediaFigure",
  // Practice
  "matchPairs",
  "listenAndChoose",
  "buildSentence",
  "speakAndScore",
  "multipleChoice",
] as const;

export type LibraryBlockSlug = (typeof LIBRARY_BLOCK_SLUGS)[number];
