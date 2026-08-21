import { PRACTICE_BLOCK_SLUGS } from "../../payload/blocks/librarySlugs";

/*
 * A shuffle that is a pure function of a seed, replacing the render-time expander.
 *
 * ── What this deletes ───────────────────────────────────────────────────────
 *
 * `utils/expandLessonItems.ts` shuffled with `Math.random` while building the
 * lesson's items, so the server produced one order and hydration produced
 * another. The player worked around its own shuffle by running the whole
 * expansion inside a `useEffect` — which meant every lesson painted a spinner
 * first, on every visit, and the CMS Live Preview panel re-shuffled on every
 * keystroke. Seeding the shuffle is what removes the mismatch, and removing the
 * mismatch is what lets the effect go.
 *
 * Nothing here reads `Math.random`, `Date` or anything else ambient. Given the
 * same list and the same seed it returns the same order in Node, in the browser,
 * and in a test — which is the whole property.
 *
 * Not `server-only`: this runs during render on both sides.
 */

/**
 * FNV-1a, 32-bit. A string seed to a number the generator can start from.
 *
 * Not a security hash and not trying to be — the requirement is that two seeds
 * that differ anywhere land on different starting points, cheaply and identically
 * in every JavaScript runtime.
 */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    // The FNV prime, as shifts: `hash * 16777619` overflows to a float and the
    // low bits stop being reliable.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32 — a small, well-distributed PRNG with 32 bits of state. */
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, driven by the seed rather than by `Math.random`. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const next = generator(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The seed for one learner's run at one lesson.
 *
 * `attempt` is what makes a replay a fresh order rather than the same order
 * forever. A signed-out learner has no id and gets a stable shared order — the
 * point is that it is the same on the server and in the browser, not that it is
 * unique to them.
 *
 * The separator matters: without one, `"ab" + "c"` and `"a" + "bc"` are the same
 * seed, so a learner switching lessons could land on another lesson's order.
 * `|` because it cannot occur in a user id or a lesson slug — the slug field is
 * a URL segment and the ids are generated.
 */
export function stepSeed({
  userId,
  lessonId,
  attempt,
}: {
  userId?: string | null;
  lessonId: string;
  attempt: number;
}): string {
  return `${userId ?? ""}|${lessonId}|${attempt}`;
}

// ── Which steps may move ─────────────────────────────────────────────────

type ShufflableStep = {
  components?: readonly { blockType: string }[] | null;
};

const PRACTICE = new Set<string>(PRACTICE_BLOCK_SLUGS);

/**
 * A screen's shape — the block types it is composed of, in order.
 *
 * Dropping `maxRows: 1` is what makes this more than the block type: "prose then
 * listenAndChoose" is a different screen from a bare "listenAndChoose", and
 * swapping one for the other would move an explanation away from the practice it
 * introduces.
 */
function shapeOf(step: ShufflableStep): string {
  return (step.components ?? []).map((c) => c.blockType).join("+");
}

/**
 * Whether a screen is practice that can be reordered against its neighbours.
 *
 * Only screens made entirely of Practice blocks. A run of prose screens has the
 * same shape as each other but is a narrative — reordering it reorders an
 * explanation — and a composite screen carries its own introduction, so it stays
 * where the author put it.
 */
function isShufflable(step: ShufflableStep): boolean {
  const components = step.components ?? [];
  return components.length > 0 && components.every((c) => PRACTICE.has(c.blockType));
}

/**
 * Shuffle within each run of consecutive same-shape practice screens.
 *
 * Not across the whole lesson: a run's position relative to the other runs never
 * moves, which is what the old per-batch shuffling did and what the lesson's
 * `shuffleSteps` field describes. Shuffling the whole list would put a
 * grammar point after the practice that depends on it.
 */
export function shuffleSteps<T extends ShufflableStep>(
  steps: readonly T[],
  { seed, enabled }: { seed: string; enabled: boolean }
): T[] {
  if (!enabled) return [...steps];

  const out: T[] = [];
  let i = 0;

  while (i < steps.length) {
    const step = steps[i];

    if (!isShufflable(step)) {
      out.push(step);
      i++;
      continue;
    }

    const shape = shapeOf(step);
    let end = i + 1;
    while (
      end < steps.length &&
      isShufflable(steps[end]) &&
      shapeOf(steps[end]) === shape
    ) {
      end++;
    }

    // Each run gets its own seed, so two runs of the same length in one lesson
    // are not permuted identically.
    out.push(...seededShuffle(steps.slice(i, end), `${seed}|${shape}|${i}`));
    i = end;
  }

  return out;
}
