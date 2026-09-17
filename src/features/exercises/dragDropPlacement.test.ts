import assert from "node:assert/strict";
import test from "node:test";

import { isCorrectPlacement, isTileCorrect } from "./dragDropPlacement";

/*
 * Length is part of the grade. An empty, short, or overfilled placement is
 * incorrect — not "not yet ready to check".
 */

test("an exact match is correct", () => {
  assert.equal(isCorrectPlacement(["あ", "お"], ["あ", "お"]), true);
});

test("too few tiles is incorrect", () => {
  assert.equal(isCorrectPlacement(["あ"], ["あ", "お"]), false);
  assert.equal(isCorrectPlacement([], ["あ", "お"]), false);
});

test("too many tiles is incorrect", () => {
  assert.equal(isCorrectPlacement(["あ", "お", "い"], ["あ", "お"]), false);
});

test("the right tiles in the wrong order are incorrect", () => {
  assert.equal(isCorrectPlacement(["お", "あ"], ["あ", "お"]), false);
});

test("a matching prefix of a longer answer is still incorrect", () => {
  assert.equal(isCorrectPlacement(["あ", "お"], ["あ", "お", "い"]), false);
});

test("comparison trims and ignores case", () => {
  assert.equal(isCorrectPlacement(["  Ha  ", "Yo"], ["ha", "yo"]), true);
});

test("isTileCorrect grades a single position independent of the rest", () => {
  const placed = ["お", "あ"]; // swapped — wrong overall
  const correct = ["あ", "お"];
  assert.equal(isTileCorrect(placed, correct, 0), false);
  assert.equal(isTileCorrect(placed, correct, 1), false);
});

test("isTileCorrect finds the positions that are right even when others aren't", () => {
  const placed = ["あ", "い", "お"]; // middle tile wrong
  const correct = ["あ", "う", "お"];
  assert.equal(isTileCorrect(placed, correct, 0), true);
  assert.equal(isTileCorrect(placed, correct, 1), false);
  assert.equal(isTileCorrect(placed, correct, 2), true);
});

test("isTileCorrect is false for a tile past the end of the answer", () => {
  assert.equal(isTileCorrect(["あ", "お", "い"], ["あ", "お"], 2), false);
});

test("isTileCorrect is false for an empty or out-of-range index", () => {
  assert.equal(isTileCorrect([], ["あ"], 0), false);
  assert.equal(isTileCorrect(["あ"], ["あ"], 5), false);
});
