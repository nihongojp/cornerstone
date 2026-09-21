function normalizeTile(tile: string): string {
  return tile.trim().toLowerCase();
}

/**
 * Whether the tiles in the drop box match the authored answer, in order.
 *
 * Length is part of the answer: too few or too many tiles is incorrect.
 * Comparison is trimmed and case-insensitive.
 */
export function isCorrectPlacement(placed: string[], correct: string[]): boolean {
  if (placed.length !== correct.length) return false;
  return placed.every(
    (tile, i) => normalizeTile(tile) === normalizeTile(correct[i] ?? "")
  );
}

/**
 * Whether the tile at `index` is the one the answer calls for at that
 * position — independent of whether the rest of the sequence is right.
 *
 * Checking is per-position on purpose: a learner who has three of five tiles
 * right should see which three, not just a single pass/fail for the whole
 * box. A placed tile past the end of `correct` (the box has more tiles than
 * the answer does) has nothing to match and is incorrect.
 */
export function isTileCorrect(placed: string[], correct: string[], index: number): boolean {
  const tile = placed[index];
  if (tile === undefined || index >= correct.length) return false;
  return normalizeTile(tile) === normalizeTile(correct[index] ?? "");
}
