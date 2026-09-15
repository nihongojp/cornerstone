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
