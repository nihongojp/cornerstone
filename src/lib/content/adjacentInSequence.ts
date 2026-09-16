/**
 * The nearest smaller and larger values in a sequence — used to pick the
 * previous and next numbered lesson on a review page without assuming the
 * current value is itself in the list (an empty Lesson 2 is still a page).
 */
export function adjacentInSequence(
  values: Iterable<number>,
  current: number
): { prev?: number; next?: number } {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  return {
    prev: unique.findLast((n) => n < current),
    next: unique.find((n) => n > current),
  };
}
