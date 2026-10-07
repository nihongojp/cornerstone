import assert from "node:assert/strict";
import test from "node:test";

import { courseLevels } from "./levels";

test("the base sections are present with no content at all", () => {
  assert.deepEqual(courseLevels([]), [1, 2, 3]);
});

test("levels in use are merged in, deduped and sorted", () => {
  assert.deepEqual(courseLevels([5, 2, 4, 5]), [1, 2, 3, 4, 5]);
});
