import type { Lesson } from "../../payload/payload-types";

/*
 * Reading & Writing lessons regrouped into 5-character sets, on the website only.
 *
 * The CMS still holds the original, smaller lessons (old 1 = あいう, old 2 = えお,
 * old 3 = かきく, old 4 = けこ, old 5 = さしすせそ). The course wants each numbered
 * lesson to cover a full row of five — あいうえお, かきくけこ, さしすせそ — so each
 * entry below says which stored lesson plays as which new level/part and, when a
 * set was split across two old lessons, which one is folded into it.
 *
 * Folding means: the absorbing lesson ("slug") plays its own steps and then the
 * absorbed lesson's, under the absorbing lesson's slug — which is also where
 * progress and notes are saved, since both are keyed by slug and the cross-schema
 * foreign key needs a real lesson. The absorbed lesson disappears from every list.
 *
 * This is a stop-gap for restructuring the lessons themselves in the CMS. When
 * that happens, delete this file and the three call sites in `content.ts`.
 */

export type ReadingMerge = {
  /** The stored lesson that plays as this new level/part. */
  slug: string;
  level: number;
  part: number;
  /** A second stored lesson whose steps are played after this one's. */
  absorbs?: string;
};

export const READING_MERGES: readonly ReadingMerge[] = [
  // New Lesson 1: あいうえお
  { slug: "hiragana-l1-v1-hokkaido", level: 1, part: 1, absorbs: "hiragana-l2-v1-hokkaido" },
  { slug: "hiragana-l1-v2-hokkaido", level: 1, part: 2, absorbs: "hiragana-l2-v2-hokkaido" },
  // New Lesson 2: かきくけこ
  { slug: "hiragana-l3-v1-iwate", level: 2, part: 1, absorbs: "hiragana-l4-v1-iwate" },
  { slug: "hiragana-l3-v2-iwate", level: 2, part: 2, absorbs: "hiragana-l4-v2-iwate" },
  { slug: "hiragana-l3-v3-iwate", level: 2, part: 3, absorbs: "hiragana-l4-v3-iwate" },
  // New Lesson 3: さしすせそ — already a full set, only renumbered
  { slug: "hiragana-l5-v1-iwate", level: 3, part: 1 },
  { slug: "hiragana-l5-v2-iwate", level: 3, part: 2 },
  { slug: "hiragana-l5-v3-iwate", level: 3, part: 3 },
];

const mergeBySlug = new Map(READING_MERGES.map((m) => [m.slug, m]));

/** absorbed slug → the slug that plays it */
const absorbedBy = new Map(
  READING_MERGES.filter((m) => m.absorbs).map((m) => [m.absorbs as string, m.slug])
);

/** Every slug that no longer appears on its own. */
export const ABSORBED_SLUGS: readonly string[] = [...absorbedBy.keys()];

export function mergeFor(slug: string): ReadingMerge | undefined {
  return mergeBySlug.get(slug);
}

/**
 * Relabels a stored lesson to its new level/part and, given the lesson it
 * absorbs, appends that lesson's steps. A lesson not in the table is returned
 * untouched.
 *
 * `cardTitle` is cleared on every lesson in the table. On a folded lesson the
 * hand-typed one names only the first half ("あ、い、う"); with it empty the list
 * derives the title from every kana the combined steps teach, in the order they
 * are taught. Clearing it on the renumbered-only ones too keeps every lesson's
 * heading in the player and on the review page the same kind ("Lesson 3 Part 1")
 * rather than the kana on some and "Lesson N Part M" on others.
 * `funFact` and the other trailing fields fall back to the absorbed lesson's, so
 * folding never drops one the first half did not have.
 */
export function relabelReadingLesson(lesson: Lesson, absorbed?: Lesson | null): Lesson {
  const merge = mergeBySlug.get(lesson.slug);
  if (!merge) return lesson;

  return {
    ...lesson,
    level: merge.level,
    part: merge.part,
    title: `Lesson ${merge.level} Part ${merge.part}`,
    cardTitle: null,
    ...(merge.absorbs
      ? {
          steps: absorbed ? [...(lesson.steps ?? []), ...(absorbed.steps ?? [])] : lesson.steps,
          funFact: lesson.funFact ?? absorbed?.funFact,
          notes: lesson.notes ?? absorbed?.notes,
          achievement: lesson.achievement ?? absorbed?.achievement,
        }
      : {}),
  };
}

/**
 * Splits the two stored lists into the two columns a learner sees, placing every
 * lesson in the table under Reading & Writing whatever its `format` says.
 * Format is what the CMS uses to pick a list, and is easy to leave on its
 * default ("step") for a hiragana lesson; the table already knows these are
 * Reading & Writing, so the page does not depend on every one being switched.
 */
export function placeLessons(
  stepLessons: Lesson[],
  flashcardLessons: Lesson[]
): { grammar: Lesson[]; reading: Lesson[] } {
  const flashcardSlugs = new Set(flashcardLessons.map((l) => l.slug));
  const all = mergeReadingLessons([...flashcardLessons, ...stepLessons]);
  const isReading = (l: Lesson) => mergeBySlug.has(l.slug) || flashcardSlugs.has(l.slug);

  return { grammar: all.filter((l) => !isReading(l)), reading: all.filter(isReading) };
}

/**
 * The lesson before or after `slug` in the order the Lessons page shows it:
 * within the same column (Grammar or Reading & Writing), by level then part.
 * Used by the review arrows so they walk the same sequence a learner sees on
 * the list, instead of the stored course order — which interleaves lessons the
 * list has split apart or folded together, and so skipped around.
 */
export function neighborInTrack(
  placed: { grammar: Lesson[]; reading: Lesson[] },
  slug: string,
  direction: "prev" | "next"
): string | undefined {
  const track = placed.reading.some((l) => l.slug === slug) ? placed.reading : placed.grammar;
  const ordered = [...track].sort((a, b) => a.level - b.level || a.part - b.part);
  const at = ordered.findIndex((l) => l.slug === slug);
  if (at === -1) return undefined;

  return ordered[direction === "next" ? at + 1 : at - 1]?.slug;
}

/**
 * Applies the table across a list. An absorbed lesson is hidden only when the
 * lesson that absorbs it is also in the list — otherwise (not published, or in a
 * different list) hiding it would make it vanish rather than merge.
 */
export function mergeReadingLessons(lessons: Lesson[]): Lesson[] {
  const bySlug = new Map(lessons.map((l) => [l.slug, l]));
  const out: Lesson[] = [];

  for (const lesson of lessons) {
    const absorber = absorbedBy.get(lesson.slug);
    if (absorber && bySlug.has(absorber)) continue;

    const absorbs = mergeBySlug.get(lesson.slug)?.absorbs;
    out.push(relabelReadingLesson(lesson, absorbs ? bySlug.get(absorbs) : undefined));
  }

  return out;
}
