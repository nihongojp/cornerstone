import assert from "node:assert/strict";
import test from "node:test";

import { describeRefusal } from "./guardReferencedDelete";

/*
 * The refusal message is the whole feature. The database will not stop this
 * delete — the foreign keys are ON DELETE SET NULL — so the only thing between
 * an editor and a silently emptied reference is this sentence being right.
 *
 * Each clause after the first is conditional, and a wrong one misleads rather
 * than breaks: "referenced 1 times" reads as sloppy, but a version-only count
 * presented as if it blocked the delete reads as a bug in the guard.
 */

const base = { owners: [], unattributed: 0, live: 1, inVersions: 0 };

test("names what holds the reference", () => {
  const msg = describeRefusal('The term "kore"', {
    ...base,
    live: 2,
    owners: ["Lesson 1", "Lesson 2"],
  });
  assert.match(msg, /The term "kore" is still referenced 2 times\./);
  assert.match(msg, /It is used by Lesson 1, Lesson 2\./);
});

test("singular and plural both read correctly", () => {
  assert.match(describeRefusal("X", { ...base, live: 1 }), /referenced 1 time\./);
  assert.match(describeRefusal("X", { ...base, live: 3 }), /referenced 3 times\./);
});

test("says what to do about it, always", () => {
  // The actionable half must survive every combination of optional clauses.
  for (const refs of [
    base,
    { ...base, owners: ["Lesson 1"] },
    { ...base, unattributed: 2 },
    { ...base, inVersions: 9 },
  ]) {
    assert.match(describeRefusal("X", refs), /remove them first/);
  }
});

test("untraceable references are counted, not hidden", () => {
  assert.match(describeRefusal("X", { ...base, unattributed: 1 }), /1 other reference could not be traced/);
  assert.match(describeRefusal("X", { ...base, unattributed: 4 }), /4 other references could not be traced/);
});

test("version-only references are mentioned as not blocking", () => {
  const msg = describeRefusal("X", { ...base, inVersions: 32 });
  assert.match(msg, /32 more sit in saved versions, which do not block this/);
});

test("no version references means no parenthetical at all", () => {
  const msg = describeRefusal("X", { ...base, inVersions: 0 });
  assert.ok(!msg.includes("saved versions"), msg);
});

test("owners are omitted rather than left dangling when none resolved", () => {
  const msg = describeRefusal("X", { ...base, owners: [], unattributed: 1 });
  assert.ok(!msg.includes("It is used by"), msg);
});
