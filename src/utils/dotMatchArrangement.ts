// Shared row-arrangement logic for "connect the dots" style matching
// exercises (MatchDots, MatchDotsMedia): randomizes the left and right
// columns independently on every attempt, and keeps the right column's
// correct answer off the same row as its left-column term as much as
// possible, so the two columns aren't just a static, always-aligned list.

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffles `pool` so that, as much as possible, no item ends up on the same
// row it occupies in `reference` — this keeps the correct right-column
// answer from lining up on the same row as its left-column term.
export function derangeRelativeTo(reference: number[], pool: number[]): number[] {
  if (pool.length <= 1) return shuffle(pool);

  let result = shuffle(pool);
  for (let attempt = 0; attempt < 20; attempt++) {
    if (result.every((v, i) => v !== reference[i])) return result;
    result = shuffle(pool);
  }

  // Fallback: targeted swaps to remove any remaining same-row matches.
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== reference[i]) continue;
    const j = result.findIndex(
      (v, idx) => idx !== i && v !== reference[i] && result[i] !== reference[idx]
    );
    if (j !== -1) [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildArrangement(
  count: number,
  options?: { keepLeftOrder?: boolean }
): { leftOrder: number[]; rightOrder: number[] } {
  const ids = Array.from({ length: count }, (_, i) => i);
  // Version 1 keeps the left column in its authored order (e.g. the order
  // hiragana were introduced on the flashcards) rather than shuffling it too.
  const leftOrder = options?.keepLeftOrder ? ids : shuffle(ids);
  const rightOrder = derangeRelativeTo(leftOrder, ids);
  return { leftOrder, rightOrder };
}
