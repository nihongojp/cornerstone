/*
 * Where a document is served on the front end.
 *
 * A leaf module with no imports, for the same reason `tags.ts` is one: this is
 * read both by `content.ts`, which carries `server-only`, and — through
 * `payload/preview.ts` — by `payload.config.ts`, which the Payload CLI loads in
 * plain Node where `server-only` throws.
 *
 * The lesson mapping lived inline in `getLessonRoute` until live preview needed
 * it too. It is stated once here rather than twice, because the two copies
 * would be the same fact: which player a lesson plays in.
 */

/** Which player a lesson plays in. Mirrors `format` on the Lessons collection. */
export function lessonHref(format: string | null | undefined, slug: string): string {
  return format === "flashcard" ? `/lesson/${slug}` : `/newlesson/${slug}`;
}

/**
 * The page that renders a document, or null when there isn't one.
 *
 * Null for a lesson with no slug — a document the editor has not saved yet has
 * nothing to point an iframe at — and null for every collection without a page
 * of its own, which is why `courses` and `media` are absent rather than listed
 * and handled.
 */
export function previewPath(
  collection: string,
  doc: Record<string, unknown> | null | undefined
): string | null {
  if (collection === "resources") return "/resources";

  if (collection === "lessons") {
    const slug = typeof doc?.slug === "string" ? doc.slug.trim() : "";
    if (!slug) return null;
    return lessonHref(typeof doc?.format === "string" ? doc.format : null, slug);
  }

  return null;
}

/*
 * The allowlist `/api/preview` redirects against.
 *
 * Matching the two real path families exactly, rather than testing that the
 * path is relative. Payload's own documentation sample checks
 * `path.startsWith('/')`, which "//evil.com" satisfies — that is a
 * protocol-relative URL, and it would turn the preview route into an open
 * redirect for anyone holding the secret. Slugs are matched against the
 * unreserved URL character set; every slug in the content model is narrower
 * than that.
 */
const PREVIEWABLE = /^\/(?:lesson|newlesson)\/[A-Za-z0-9._~-]+$|^\/resources$/;

export function isPreviewablePath(path: string): boolean {
  return PREVIEWABLE.test(path);
}
