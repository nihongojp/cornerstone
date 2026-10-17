/**
 * Missing recordings observed in production on 2026-10-17, before PR #99.
 * Keep these visible as editorial debt without exempting new audio failures.
 * Remove entries once the recordings land; see docs/content-backlog.md.
 */
const RECORDING_BACKLOG = [
  {
    lesson: "grammar-l2-v1",
    where: "step[3].components[0]:matchPairs",
    keys: ["sumimasen-wakarimasen"],
  },
  {
    lesson: "hiragana-l6-v1-iwate",
    where: "step[6].components[0]:matchPairs",
    keys: ["た-タ", "ち-チ", "つ-ツ", "て-テ", "と-ト"],
  },
];

export function isKnownRecordingGap(
  lesson: string,
  where: string,
  pairing: string,
  missingKeys: string[],
): boolean {
  if (pairing !== "audio" || missingKeys.length === 0) return false;
  return RECORDING_BACKLOG.some(
    (entry) => entry.lesson === lesson && entry.where === where &&
      missingKeys.every((key) => entry.keys.includes(key)),
  );
}
