/*
 * Which numbered lessons the course has sections for.
 *
 * Stated once because two pages have to agree on it: the lesson list draws a
 * section per level, and the per-level review page steps between them with
 * prev/next arrows. If each kept its own copy the arrows could point at a
 * level the list does not show, or skip one it does.
 */

/** Sections that always exist, whether or not any lesson is in them yet. */
export const BASE_LEVELS: readonly number[] = [1, 2, 3];

/** The base sections plus every level the content actually uses, ascending. */
export function courseLevels(levelsInUse: Iterable<number>): number[] {
  return [...new Set([...BASE_LEVELS, ...levelsInUse])].sort((a, b) => a - b);
}
