// Coarse articulatory-feature tables for scoring how "close" two IPA
// phonemes are, so pronunciation scoring can discount accent-flavored
// near-misses (e.g. the Japanese tap /r/ realized as [d]) relative to
// genuinely unrelated substitutions — without hardcoding rules per learner
// L1. Distances are heuristic approximations, not a linguistics reference;
// good enough for relative "close vs. far" scoring.
//
// Coverage is intentionally partial: the tokens included are the ones
// realistically produced by English/Japanese-learner speech. Any pair
// involving a token outside these tables falls back to the maximum
// distance (1) in `phonemeDistance` below — unknown pairs never get a
// fairness discount, they just behave like the old unweighted scoring.

type Consonant = { kind: "consonant"; place: number; manner: number; voiced: boolean };
type Vowel = { kind: "vowel"; height: number; backness: number; long: boolean };
type Phone = Consonant | Vowel;

const C = (place: number, manner: number, voiced: boolean): Consonant => ({ kind: "consonant", place, manner, voiced });
const V = (height: number, backness: number, long: boolean): Vowel => ({ kind: "vowel", height, backness, long });

// place: 0 bilabial .. 8 glottal | manner: 0 plosive, ~0.8 nasal, ~1.3 affricate,
// ~2 tap, ~2.2 trill, ~2.5 fricative, ~3.5 lateral, ~4 approximant/glide
const PHONES: Record<string, Phone> = {
  // Plosives
  p: C(0, 0, false), b: C(0, 0, true),
  t: C(3, 0, false), d: C(3, 0, true),
  k: C(6, 0, false), ɡ: C(6, 0, true), g: C(6, 0, true),
  q: C(7, 0, false), ʔ: C(8, 0, false),

  // Nasals
  m: C(0, 0.8, true), n: C(3, 0.8, true), ŋ: C(6, 0.8, true), ɲ: C(5, 0.8, true), "n̩": C(3, 0.8, true),

  // Affricates
  tʃ: C(4, 1.3, false), dʒ: C(4, 1.3, true),
  ts: C(3, 1.3, false), dz: C(3, 1.3, true),
  tɕ: C(4.2, 1.3, false), dʑ: C(4.2, 1.3, true),

  // Taps/trills (Japanese/Spanish-style r)
  ɾ: C(3, 2, true), r: C(3, 2.2, true),

  // Fricatives
  f: C(1, 2.5, false), v: C(1, 2.5, true),
  θ: C(2, 2.5, false), ð: C(2, 2.5, true),
  s: C(3, 2.5, false), z: C(3, 2.5, true),
  ʃ: C(4, 2.5, false), ʒ: C(4, 2.5, true),
  ɕ: C(4.2, 2.5, false), ʑ: C(4.2, 2.5, true),
  ç: C(5, 2.5, false), x: C(6, 2.5, false), ɣ: C(6, 2.5, true),
  ʁ: C(7, 2.5, true), h: C(8, 2.5, false),
  β: C(0, 2.5, true), ɸ: C(0, 2.5, false),

  // Laterals
  l: C(3, 3.5, true), ɭ: C(4.5, 3.5, true), ʎ: C(5, 3.5, true), ɫ: C(3, 3.5, true),

  // Approximants/glides (English-style /r/ is much further from a stop
  // than the tap [ɾ]/[r] above — kept distinct on purpose)
  ɹ: C(3, 4, true), j: C(5, 4, true), w: C(3, 4, true), ʋ: C(1, 4, true), ɰ: C(6, 4, true),

  // Vowels — height: 0 open(low) .. 1 close(high) | backness: 0 front .. 1 back
  i: V(1, 0, false), iː: V(1, 0, true),
  ɪ: V(0.8, 0.1, false),
  e: V(0.7, 0, false), eː: V(0.7, 0, true),
  ɛ: V(0.55, 0.05, false), ɛː: V(0.55, 0.05, true),
  æ: V(0.3, 0, false),
  a: V(0.15, 0.3, false), aː: V(0.15, 0.3, true),
  ɑ: V(0.05, 0.9, false), ɑː: V(0.05, 0.9, true),
  ɐ: V(0.2, 0.5, false),
  ʌ: V(0.45, 0.7, false),
  ə: V(0.5, 0.5, false), ɚ: V(0.5, 0.5, false),
  ɜ: V(0.5, 0.4, false), ɜː: V(0.5, 0.4, true),
  u: V(1, 1, false), uː: V(1, 1, true),
  ʊ: V(0.8, 0.9, false),
  o: V(0.7, 1, false), oː: V(0.7, 1, true),
  ɔ: V(0.55, 0.95, false), ɔː: V(0.55, 0.95, true),
  ɒ: V(0.15, 1, false),
  y: V(1, 0.3, false), yː: V(1, 0.3, true),
  ø: V(0.7, 0.3, false), œ: V(0.55, 0.3, false),

  // Diphthongs — approximated by their starting vowel quality, marked long
  aɪ: V(0.15, 0.2, true), aʊ: V(0.15, 0.6, true),
  eɪ: V(0.6, 0.1, true), oʊ: V(0.6, 0.9, true), ɔɪ: V(0.4, 0.7, true),
};

const MAX_PLACE_SPAN = 8;
const MAX_MANNER_SPAN = 4;

/**
 * Strips trailing tone-number annotations (e.g. "i5", "ɑ5") that this
 * multilingual model sometimes emits — an artifact of espeak's Mandarin
 * phoneme set bleeding into output for other languages. The digit carries
 * no segmental identity for our purposes, so "i5" is just "i".
 */
export function normalizePhonemeToken(token: string): string {
  return token.replace(/[0-9]+$/, "");
}

/**
 * Heuristic distance between two IPA phoneme tokens, in [0, 1] — 0 identical,
 * 1 maximally different (including any cross vowel/consonant substitution,
 * or either token being outside our coverage).
 */
export function phonemeDistance(rawA: string, rawB: string): number {
  const a = normalizePhonemeToken(rawA);
  const b = normalizePhonemeToken(rawB);
  if (a === b) return 0;

  const pa = PHONES[a];
  const pb = PHONES[b];
  if (!pa || !pb || pa.kind !== pb.kind) return 1;

  if (pa.kind === "consonant" && pb.kind === "consonant") {
    const placeDist = Math.abs(pa.place - pb.place) / MAX_PLACE_SPAN;
    const mannerDist = Math.abs(pa.manner - pb.manner) / MAX_MANNER_SPAN;
    const voiceDist = pa.voiced !== pb.voiced ? 1 : 0;
    return clamp01(0.45 * placeDist + 0.35 * mannerDist + 0.2 * voiceDist);
  }

  const va = pa as Vowel;
  const vb = pb as Vowel;
  const heightDist = Math.abs(va.height - vb.height);
  const backnessDist = Math.abs(va.backness - vb.backness);
  const lengthDist = va.long !== vb.long ? 1 : 0;
  return clamp01(0.4 * heightDist + 0.4 * backnessDist + 0.2 * lengthDist);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
