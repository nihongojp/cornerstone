/**
 * A term offered as a multiple-choice tile: the word, and its picture if it has
 * one.
 *
 * Declared here because this is the module that builds the choice set. It used
 * to live in `utils/expandLessonItems.ts`, which generated the exercises at
 * render time and is gone — the distractors are an authored `distractors`
 * relationship on the block now.
 */
export type ChoiceCandidate = { phrase: string; imageUrl?: string };

function randomShuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The correct choice plus up to `distractorCount` random, DISTINCT
 * distractors from `pool`, in a freshly randomised order. Never pads with a
 * duplicate of the correct answer (or of a distractor already picked) — if
 * fewer than `distractorCount` distinct distractors exist in the pool, fewer
 * tiles are returned. Callers should invoke this once per exercise
 * presentation (e.g. inside a `useState` lazy initializer) so the choice set
 * and order are stable for that attempt but fresh on the next one.
 */
export function buildChoiceOptions(
  correct: ChoiceCandidate,
  pool: ChoiceCandidate[],
  distractorCount: number
): ChoiceCandidate[] {
  const seenPhrases = new Set<string>([correct.phrase]);
  const distractorCandidates: ChoiceCandidate[] = [];
  for (const c of pool) {
    if (seenPhrases.has(c.phrase)) continue;
    seenPhrases.add(c.phrase);
    distractorCandidates.push(c);
  }

  const distractors = randomShuffle(distractorCandidates).slice(0, distractorCount);
  return randomShuffle([correct, ...distractors]);
}
