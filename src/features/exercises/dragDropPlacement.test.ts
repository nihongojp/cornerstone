import assert from "node:assert/strict";
import test from "node:test";

import { isCorrectPlacement } from "./dragDropPlacement";

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
