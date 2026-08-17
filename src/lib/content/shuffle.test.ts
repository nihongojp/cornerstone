import assert from "node:assert/strict";
import test from "node:test";

import { exerciseSeed, seededShuffle, shuffleExercises } from "./shuffle";

/*
 * The seeded shuffle exists to delete a workaround, so the property that matters
 * is not "is it random" but "is it the same twice".
 *
 * `expandLessonItems` shuffled with `Math.random` during render, which produced
 * one order on the server and a different one during hydration. The fix was to
 * run the whole expansion inside a `useEffect` — so the lesson rendered a
 * spinner on first paint, every visit, purely to hide a mismatch it caused
 * itself. A shuffle that is a pure function of its seed has no mismatch to hide,
 * which is what lets that effect go.
 *
 * Bugs here are silent: a shuffle that ignores its seed still returns a
 * plausible-looking list, and a shuffle that drops an element still renders.
 */

const letters = () => ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

test("the same seed gives the same order", () => {
  assert.deepEqual(seededShuffle(letters(), "u1:l1:0"), seededShuffle(letters(), "u1:l1:0"));
});

test("the order is a permutation — nothing is dropped or duplicated", () => {
  const out = seededShuffle(letters(), "u1:l1:0");
  assert.equal(out.length, letters().length);
  assert.deepEqual([...out].sort(), letters().sort());
});

test("a different seed gives a different order", () => {
  // Ten elements: 10! orders, so an accidental match is not what a failure here
  // would mean. A failure means the seed is not reaching the generator at all,
  // which is the way this function breaks silently.
  assert.notDeepEqual(seededShuffle(letters(), "u1:l1:0"), seededShuffle(letters(), "u2:l1:0"));
  assert.notDeepEqual(seededShuffle(letters(), "u1:l1:0"), seededShuffle(letters(), "u1:l2:0"));
  assert.notDeepEqual(seededShuffle(letters(), "u1:l1:0"), seededShuffle(letters(), "u1:l1:1"));
});

test("the input is not mutated", () => {
  const input = letters();
  seededShuffle(input, "u1:l1:0");
  assert.deepEqual(input, letters());
});

test("empty and single-element lists come back unchanged", () => {
  assert.deepEqual(seededShuffle([], "seed"), []);
  assert.deepEqual(seededShuffle(["only"], "seed"), ["only"]);
});

test("it actually reorders rather than returning the input order", () => {
  // A generator that always returns 0 would pass every test above.
  const identity = letters();
  const seeds = ["a", "b", "c", "d", "e"].map((s) => seededShuffle(letters(), s));
  assert.ok(seeds.some((out) => !out.every((v, i) => v === identity[i])));
});

// ── The seed ─────────────────────────────────────────────────────────────────

test("a signed-out learner gets a stable seed rather than a random one", () => {
  // No user id is the ordinary case for a lesson opened signed out. Everyone
  // signed out sees the same order, which is fine; what matters is that it is
  // the same order on the server and in the browser.
  assert.equal(
    exerciseSeed({ userId: undefined, lessonId: "l1-v2", attempt: 0 }),
    exerciseSeed({ userId: undefined, lessonId: "l1-v2", attempt: 0 })
  );
});

test("the seed separates its parts so they cannot run together", () => {
  // "ab" + "c" and "a" + "bc" must not be one seed. Without a separator a user
  // switching lessons could silently land on the order of a different one.
  assert.notEqual(
    exerciseSeed({ userId: "ab", lessonId: "c", attempt: 0 }),
    exerciseSeed({ userId: "a", lessonId: "bc", attempt: 0 })
  );
});

// ── The grouping policy ──────────────────────────────────────────────────────
/*
 * `shuffleExercises` shuffles *within a run of consecutive exercises of the same
 * shape*, not across the whole lesson. That is what the old code did — each
 * generated batch was shuffled on its own, so a batch's position relative to the
 * other batches never moved — and it is the behaviour the lesson field describes.
 * Shuffling the whole list would put a grammar explanation after the practice
 * that depends on it.
 */

const ex = (id: string, ...blockTypes: string[]) => ({
  id,
  components: blockTypes.map((blockType) => ({ blockType })),
});

const ids = (list: ReturnType<typeof ex>[]) => list.map((e) => e.id);

test("a prose screen never moves", () => {
  const list = [
    ex("intro", "prose"),
    ex("p1", "listenAndChoose"),
    ex("p2", "listenAndChoose"),
    ex("p3", "listenAndChoose"),
    ex("outro", "prose"),
  ];
  const out = shuffleExercises(list, { seed: "u1:l1:0", enabled: true });
  assert.equal(out[0].id, "intro");
  assert.equal(out[4].id, "outro");
  assert.deepEqual(ids(out).slice(1, 4).sort(), ["p1", "p2", "p3"]);
});

test("two runs of different shapes do not mix", () => {
  const list = [
    ex("a1", "listenAndChoose"),
    ex("a2", "listenAndChoose"),
    ex("b1", "speakAndScore"),
    ex("b2", "speakAndScore"),
  ];
  const out = shuffleExercises(list, { seed: "u1:l1:0", enabled: true });
  assert.deepEqual(ids(out).slice(0, 2).sort(), ["a1", "a2"]);
  assert.deepEqual(ids(out).slice(2, 4).sort(), ["b1", "b2"]);
});

test("consecutive Content screens are never shuffled with each other", () => {
  // Shape alone is not enough to decide a run is shufflable. Two prose screens
  // in a row are a narrative — reordering them reorders an explanation. Only
  // Practice runs shuffle, which is what the old per-batch shuffling did.
  const list = ["c1", "c2", "c3", "c4"].map((id) => ex(id, "prose"));
  for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
    assert.deepEqual(ids(shuffleExercises(list, { seed, enabled: true })), ids(list));
  }
});

test("a run does get reordered for some seed", () => {
  const list = ["p1", "p2", "p3", "p4", "p5"].map((id) => ex(id, "listenAndChoose"));
  const orders = ["s1", "s2", "s3", "s4", "s5"].map((seed) =>
    ids(shuffleExercises(list, { seed, enabled: true }))
  );
  assert.ok(orders.some((order) => order.join() !== ids(list).join()));
});

test("disabled means authored order, exactly", () => {
  const list = ["p1", "p2", "p3", "p4"].map((id) => ex(id, "listenAndChoose"));
  assert.deepEqual(ids(shuffleExercises(list, { seed: "u1:l1:0", enabled: false })), ids(list));
});

test("a composite screen is its own shape, not the shape of its first block", () => {
  // Dropping `maxRows: 1` is what makes this possible: "prose + listenAndChoose"
  // is a different screen from a bare "listenAndChoose", and swapping one for
  // the other would move an explanation away from the practice it introduces.
  const list = [
    ex("c1", "prose", "listenAndChoose"),
    ex("p1", "listenAndChoose"),
    ex("p2", "listenAndChoose"),
  ];
  const out = shuffleExercises(list, { seed: "u1:l1:0", enabled: true });
  assert.equal(out[0].id, "c1");
});

test("the whole thing is stable across calls, which is the SSR/hydration claim", () => {
  const list = ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => ex(id, "listenAndChoose"));
  const opts = { seed: exerciseSeed({ userId: "u1", lessonId: "l1-v2", attempt: 2 }), enabled: true };
  assert.deepEqual(ids(shuffleExercises(list, opts)), ids(shuffleExercises(list, opts)));
});
