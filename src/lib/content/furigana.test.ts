import assert from "node:assert/strict";
import test from "node:test";

import { renderableTerm, type TermLike } from "./furigana";

/*
 * What a `termRef` shows, decided here rather than in JSX so it can be tested
 * without a renderer. The failures this is guarding against are all silent: a
 * term with no Japanese script rendering as a gap, an okurigana segment
 * emitting an empty `<rt>`, a `showAudio` toggle pointing at nothing.
 *
 * 24 of the 41 seeded terms have no Japanese script at all — the imported
 * content is romaji only — so the fallback chain is the common path here, not
 * the edge case.
 */

const term = (over: Partial<TermLike> = {}): TermLike => ({
  key: "hajimemashite",
  japanese: null,
  katakana: null,
  reading: null,
  romaji: null,
  meaning: null,
  furigana: null,
  ...over,
});

test("furigana display uses the term's authored segments", () => {
  const result = renderableTerm(
    term({ japanese: "食べる", furigana: [{ base: "食", ruby: "た" }, { base: "べる" }] }),
    "furigana"
  );

  assert.deepEqual(result, {
    kind: "ruby",
    segments: [{ base: "食", ruby: "た" }, { base: "べる" }],
  });
});

test("a segment with an empty reading carries no ruby rather than an empty one", () => {
  const result = renderableTerm(
    term({ japanese: "食べる", furigana: [{ base: "食", ruby: "た" }, { base: "べる", ruby: "" }] }),
    "furigana"
  );

  assert.deepEqual(result, {
    kind: "ruby",
    segments: [{ base: "食", ruby: "た" }, { base: "べる" }],
  });
});

test("with no segments authored, the whole word takes the reading as its ruby", () => {
  const result = renderableTerm(
    term({ japanese: "初めまして", reading: "はじめまして" }),
    "furigana"
  );

  assert.deepEqual(result, {
    kind: "ruby",
    segments: [{ base: "初めまして", ruby: "はじめまして" }],
  });
});

test("segments with no readings at all render as plain text, not empty ruby", () => {
  const result = renderableTerm(
    term({ japanese: "ねこ", furigana: [{ base: "ねこ" }] }),
    "furigana"
  );

  assert.deepEqual(result, { kind: "text", text: "ねこ" });
});

test("furigana falls back through reading then romaji for the romaji-only catalogue", () => {
  assert.deepEqual(renderableTerm(term({ reading: "はじめまして" }), "furigana"), {
    kind: "text",
    text: "はじめまして",
  });
  assert.deepEqual(renderableTerm(term({ romaji: "Hajimemashite" }), "furigana"), {
    kind: "text",
    text: "Hajimemashite",
  });
});

test("plain display never emits ruby, even when segments exist", () => {
  const result = renderableTerm(
    term({ japanese: "食べる", furigana: [{ base: "食", ruby: "た" }] }),
    "plain"
  );

  assert.deepEqual(result, { kind: "text", text: "食べる" });
});

test("each display mode prefers its own field", () => {
  const full = term({
    japanese: "初めまして",
    reading: "はじめまして",
    romaji: "Hajimemashite",
    meaning: "Nice to meet you",
  });

  assert.deepEqual(renderableTerm(full, "plain"), { kind: "text", text: "初めまして" });
  assert.deepEqual(renderableTerm(full, "reading"), { kind: "text", text: "はじめまして" });
  assert.deepEqual(renderableTerm(full, "romaji"), { kind: "text", text: "Hajimemashite" });
  assert.deepEqual(renderableTerm(full, "meaning"), { kind: "text", text: "Nice to meet you" });
});

test("a missing field falls back rather than rendering a gap in the sentence", () => {
  const romajiOnly = term({ romaji: "Hajimemashite" });

  for (const display of ["plain", "reading", "romaji", "meaning"] as const) {
    assert.deepEqual(
      renderableTerm(romajiOnly, display),
      { kind: "text", text: "Hajimemashite" },
      `display ${display}`
    );
  }
});

test("a kana term shows both scripts, which is what the old \"あ/ア\" string encoded", () => {
  const result = renderableTerm(term({ japanese: "あ", katakana: "ア" }), "plain");

  assert.deepEqual(result, { kind: "text", text: "あ / ア" });
});

test("a term with nothing but a key renders the key rather than nothing", () => {
  assert.deepEqual(renderableTerm(term(), "furigana"), { kind: "text", text: "hajimemashite" });
});

test("an unpopulated relationship renders nothing at all", () => {
  // A bare id means the read did not ask for enough depth. Rendering "5" is
  // never right, and this is the failure mode raising CONTENT_DEPTH guards.
  assert.equal(renderableTerm(7, "furigana"), null);
  assert.equal(renderableTerm(null, "furigana"), null);
  assert.equal(renderableTerm(undefined, "furigana"), null);
});
