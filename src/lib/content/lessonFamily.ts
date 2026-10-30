/*
 * Which family a lesson belongs to, read off its slug.
 *
 * Slugs are `<family>-l<level>-v<version>` (see the slug field on the Lessons
 * collection): `grammar-l1-v1`, `hiragana-l2-v1-hokkaido`. The family is the part a
 * screen sometimes needs to behave differently for, and the slug is the one place
 * it is written down — `format` says which player runs a lesson and which list it
 * is in, and has been wrong for hiragana lessons before.
 */
export function isGrammarLesson(slug: string | null | undefined): boolean {
  return /^grammar(-|$)/.test(slug ?? "");
}
