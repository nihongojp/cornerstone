import assert from "node:assert/strict";
import test from "node:test";

import type { Lesson } from "../../payload/payload-types";
import { flashcardsLast, isFlashcardStep } from "./flashcardOrder";

type Step = NonNullable<Lesson["steps"]>[number];

const step = (id: string, ...components: Record<string, unknown>[]) => ({ id, components }) as unknown as Step;
const cards = (id: string) => step(id, { blockType: "vocabList", layout: "flashcards" });
const spotlight = (id: string) => step(id, { blockType: "vocabList", layout: "spotlight" });
const exercise = (id: string) => step(id, { blockType: "buildSentence" });

test("only a vocabulary block laid out as flashcards makes a flashcard step", () => {
  assert.equal(isFlashcardStep(cards("a")), true);
  assert.equal(isFlashcardStep(spotlight("a")), false);
  assert.equal(isFlashcardStep(exercise("a")), false);
  assert.equal(isFlashcardStep(step("a")), false);
});

test("flashcards gather at the end, together, in their original order", () => {
  const ordered = flashcardsLast([cards("c1"), spotlight("s1"), cards("c2"), exercise("e1"), cards("c3"), exercise("e2")]);
  assert.deepEqual(ordered.map((s) => s.id), ["s1", "e1", "e2", "c1", "c2", "c3"]);
});

test("everything else keeps its order, and a lesson with no flashcards is unchanged", () => {
  const plain = [spotlight("s1"), exercise("e1"), exercise("e2")];
  assert.deepEqual(flashcardsLast(plain).map((s) => s.id), ["s1", "e1", "e2"]);
  assert.deepEqual(flashcardsLast([]), []);
});

test("a step that mixes flashcards with other blocks moves as a whole", () => {
  const mixed = step("m", { blockType: "prose" }, { blockType: "vocabList", layout: "flashcards" });
  assert.deepEqual(flashcardsLast([mixed, exercise("e1")]).map((s) => s.id), ["e1", "m"]);
});
