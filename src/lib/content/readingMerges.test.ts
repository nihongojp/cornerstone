import assert from "node:assert/strict";
import test from "node:test";

import type { Lesson } from "../../payload/payload-types";
import {
  mergeReadingLessons,
  neighborInTrack,
  placeLessons,
  relabelReadingLesson,
} from "./readingMerges";

const lesson = (slug: string, extra: Partial<Lesson> = {}): Lesson =>
  ({ id: 1, slug, title: slug, level: 9, part: 9, steps: [], ...extra }) as unknown as Lesson;

const step = (id: string) => ({ id, components: [] }) as unknown as NonNullable<Lesson["steps"]>[number];

test("a folded lesson plays its own steps, then the absorbed lesson's", () => {
  const a = lesson("hiragana-l1-v1-hokkaido", { steps: [step("a1"), step("a2")] });
  const b = lesson("hiragana-l2-v1-hokkaido", { steps: [step("b1")] });

  const out = mergeReadingLessons([a, b]);

  assert.equal(out.length, 1);
  assert.deepEqual(out[0].steps?.map((s) => s.id), ["a1", "a2", "b1"]);
});

test("the folded lesson takes the new level and part, and drops its hand-typed card title", () => {
  const a = lesson("hiragana-l3-v2-iwate", { cardTitle: "え、お、か、き、く" });
  const b = lesson("hiragana-l4-v2-iwate");

  const [merged] = mergeReadingLessons([a, b]);

  assert.equal(merged.level, 2);
  assert.equal(merged.part, 2);
  assert.equal(merged.title, "Lesson 2 Part 2");
  assert.equal(merged.cardTitle, null);
});

test("the absorbed lesson is hidden only when the lesson that absorbs it is present", () => {
  const orphan = lesson("hiragana-l2-v1-hokkaido");

  assert.deepEqual(mergeReadingLessons([orphan]).map((l) => l.slug), ["hiragana-l2-v1-hokkaido"]);
});

test("a lesson already forming a full set is renumbered and headed like the folded ones", () => {
  const out = relabelReadingLesson(lesson("hiragana-l5-v2-iwate", { cardTitle: "さ、し、す、せ、そ" }));

  assert.equal(out.level, 3);
  assert.equal(out.part, 2);
  assert.equal(out.title, "Lesson 3 Part 2");
  assert.equal(out.cardTitle, null);
});

test("a fun fact on the absorbed lesson is not lost when the first half has none", () => {
  const funFact = { root: {} } as unknown as Lesson["funFact"];
  const a = lesson("hiragana-l1-v2-hokkaido");
  const b = lesson("hiragana-l2-v2-hokkaido", { funFact });

  assert.equal(mergeReadingLessons([a, b])[0].funFact, funFact);
});

test("hiragana lessons left on the Step format still land under Reading & Writing, folded", () => {
  const first = lesson("hiragana-l1-v1-hokkaido", { steps: [step("a1")] });
  const secondStepFormat = lesson("hiragana-l2-v1-hokkaido", { steps: [step("b1")] });
  const grammar = lesson("grammar-l1-v1", { level: 1, part: 1 });

  const placed = placeLessons([secondStepFormat, grammar], [first]);

  assert.deepEqual(placed.grammar.map((l) => l.slug), ["grammar-l1-v1"]);
  assert.deepEqual(placed.reading.map((l) => l.slug), ["hiragana-l1-v1-hokkaido"]);
  assert.deepEqual(placed.reading[0].steps?.map((s) => s.id), ["a1", "b1"]);
});

test("review neighbours follow the Lessons page order within one column", () => {
  const read = (slug: string, level: number, part: number) => lesson(slug, { level, part });
  const placed = {
    grammar: [read("g-1-1", 1, 1), read("g-1-2", 1, 2)],
    reading: [read("r-2-1", 2, 1), read("r-1-2", 1, 2), read("r-1-1", 1, 1)],
  };

  assert.equal(neighborInTrack(placed, "r-1-2", "prev"), "r-1-1");
  assert.equal(neighborInTrack(placed, "r-1-2", "next"), "r-2-1");
  assert.equal(neighborInTrack(placed, "r-1-1", "prev"), undefined);
  assert.equal(neighborInTrack(placed, "g-1-1", "next"), "g-1-2");
  assert.equal(neighborInTrack(placed, "g-1-2", "next"), undefined);
});

test("lessons outside the table pass through untouched", () => {
  const grammar = lesson("grammar-l1-v1", { level: 1, part: 1 });

  assert.deepEqual(mergeReadingLessons([grammar]), [grammar]);
});
