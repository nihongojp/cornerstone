import { phonemeDistance } from "./phoneticFeatures";

export type PhonemeOp =
  | { type: "match"; phoneme: string }
  | { type: "sub"; expected: string; actual: string; cost: number } // cost in [0,1]; near-miss substitutions (accent-flavored) cost less than unrelated ones
  | { type: "del"; expected: string } // expected phoneme the user missed
  | { type: "ins"; actual: string }; // extra phoneme the user added

export type PhonemeAlignment = {
  score: number; // 0..1, 1 = perfect match
  ops: PhonemeOp[];
};

/**
 * Aligns the user's recognized phonemes against the expected (reference)
 * phonemes via weighted edit distance with backtrace, then scores the match
 * as 1 - (total cost / expected length).
 *
 * Substitution cost is phonetic-distance-weighted (see phoneticFeatures.ts)
 * rather than a flat 1, so an accent-flavored near-miss (e.g. the Japanese
 * tap /r/ heard as [d]) costs less than an unrelated substitution — without
 * hardcoding rules per learner's native language. Deletions/insertions stay
 * at a flat cost of 1: a dropped or added phoneme is a real segment miss,
 * not an accent nuance. Ties are resolved toward substitution over
 * insert+delete, which reads more naturally for phoneme diffs.
 */
export function alignPhonemes(expected: string[], actual: string[]): PhonemeAlignment {
  const n = expected.length;
  const m = actual.length;

  // dp[i][j] = weighted cost between expected[0..i) and actual[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (expected[i - 1] === actual[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        const subCost = phonemeDistance(expected[i - 1], actual[j - 1]);
        dp[i][j] = Math.min(dp[i - 1][j - 1] + subCost, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
      }
    }
  }

  const ops: PhonemeOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1]) {
      ops.push({ type: "match", phoneme: expected[i - 1] });
      i--; j--;
    } else if (
      i > 0 && j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + phonemeDistance(expected[i - 1], actual[j - 1])
    ) {
      ops.push({ type: "sub", expected: expected[i - 1], actual: actual[j - 1], cost: phonemeDistance(expected[i - 1], actual[j - 1]) });
      i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: "del", expected: expected[i - 1] });
      i--;
    } else {
      ops.push({ type: "ins", actual: actual[j - 1] });
      j--;
    }
  }
  ops.reverse();

  const totalCost = dp[n][m];
  const score = n === 0 ? (m === 0 ? 1 : 0) : Math.max(0, 1 - totalCost / n);

  return { score, ops };
}
