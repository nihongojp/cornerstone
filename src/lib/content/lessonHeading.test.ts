import assert from "node:assert/strict";
import test from "node:test";

import { lessonHeading } from "./lessonHeading";

test("the heading is the lesson number and the part number", () => {
  assert.equal(lessonHeading({ level: 1, part: 1 }), "Lesson 1 Part 1");
  assert.equal(lessonHeading({ level: 3, part: 2 }), "Lesson 3 Part 2");
});
