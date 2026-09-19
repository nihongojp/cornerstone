import assert from "node:assert/strict";
import test from "node:test";

import { adjacentInSequence } from "./adjacentInSequence";

test("picks the nearest values on either side", () => {
  assert.deepEqual(adjacentInSequence([1, 2, 3], 2), { prev: 1, next: 3 });
});

test("omits a side that has nothing", () => {
  assert.deepEqual(adjacentInSequence([1, 2, 3], 1), { prev: undefined, next: 2 });
  assert.deepEqual(adjacentInSequence([1, 2, 3], 3), { prev: 2, next: undefined });
});

test("skips a gap when the current value is not in the list", () => {
  assert.deepEqual(adjacentInSequence([1, 3], 2), { prev: 1, next: 3 });
});

test("dedupes and sorts", () => {
  assert.deepEqual(adjacentInSequence([3, 1, 1, 2], 2), { prev: 1, next: 3 });
});
