import assert from "node:assert/strict";
import test from "node:test";

import {
  countBlanks,
  dropdownChoices,
  gradeBlanks,
  isBlankCorrect,
  normalizeAnswer,
  problemWithBlock,
  splitLines,
  splitSentence,
} from "./fillInBlank";

test("a sentence is cut into text and numbered blanks", () => {
  assert.deepEqual(splitSentence("Kore ___ hon ___."), [
    { kind: "text", text: "Kore " },
    { kind: "blank", index: 0 },
    { kind: "text", text: " hon " },
    { kind: "blank", index: 1 },
    { kind: "text", text: "." },
  ]);
});

test("a blank at the very start or end leaves no empty text part", () => {
  assert.deepEqual(splitSentence("___ desu ___"), [
    { kind: "blank", index: 0 },
    { kind: "text", text: " desu " },
    { kind: "blank", index: 1 },
  ]);
});

test("three or more underscores is one blank; fewer is just text", () => {
  assert.equal(countBlanks("a _____ b __ c"), 1);
  assert.equal(countBlanks("no blanks here"), 0);
});

test("typed answers ignore case, outer space, width and a trailing full stop", () => {
  const blank = { answer: "desu" };
  assert.equal(isBlankCorrect("  DESU ", blank), true);
  assert.equal(isBlankCorrect("ｄｅｓｕ", blank), true);
  assert.equal(isBlankCorrect("desu.", blank), true);
  assert.equal(isBlankCorrect("desu。", blank), true);
  assert.equal(isBlankCorrect("de su", blank), false);
});

test("an empty answer is never correct, even against an empty-looking answer", () => {
  assert.equal(isBlankCorrect("", { answer: "desu" }), false);
  assert.equal(isBlankCorrect("   ", { answer: "desu" }), false);
});

test("alsoAccept lists other right spellings", () => {
  const blank = { answer: "です", alsoAccept: ["desu"] };
  assert.equal(isBlankCorrect("desu", blank), true);
  assert.equal(isBlankCorrect("です", blank), true);
  assert.equal(isBlankCorrect("デス", blank), false);
});

test("hiragana and katakana are different answers", () => {
  assert.equal(isBlankCorrect("カ", { answer: "か" }), false);
});

test("grading gives one verdict per blank, in order, and counts a missing one as wrong", () => {
  const blanks = [{ answer: "a" }, { answer: "b" }, { answer: "c" }];
  assert.deepEqual(gradeBlanks(["a", "x"], blanks), [true, false, false]);
});

test("dropdown choices hold the answer once, with duplicates and blanks removed", () => {
  const choices = dropdownChoices({ answer: "wa", distractors: ["ga", "WA", " ", "ga", "no"] }, "s");
  assert.deepEqual([...choices].sort(), ["ga", "no", "wa"]);
});

test("dropdown order is the same for the same seed and does not always lead with the answer", () => {
  const blank = { answer: "wa", distractors: ["ga", "no", "wo", "ni"] };
  assert.deepEqual(dropdownChoices(blank, "same"), dropdownChoices(blank, "same"));
  const firsts = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => dropdownChoices(blank, s)[0]));
  assert.ok(firsts.size > 1, "the first choice should vary with the seed");
});

test("a block with no blank in the sentence is rejected", () => {
  assert.match(problemWithBlock({ mode: "typed", sentence: "Kore wa hon desu.", blanks: [{ answer: "x" }] }) ?? "", /at least one blank/);
});

test("the number of blanks must match the number of rows, either way round", () => {
  assert.match(problemWithBlock({ mode: "typed", sentence: "___ ___", blanks: [{ answer: "a" }] }) ?? "", /2 blanks.*1 row/);
  assert.match(problemWithBlock({ mode: "typed", sentence: "___", blanks: [{ answer: "a" }, { answer: "b" }] }) ?? "", /1 blank.*2 rows/);
});

test("every blank needs an answer", () => {
  assert.match(problemWithBlock({ mode: "typed", sentence: "___ ___", blanks: [{ answer: "a" }, { answer: " " }] }) ?? "", /Blank 2 has no answer/);
});

test("a dropdown blank needs a wrong choice that is not the answer", () => {
  const sentence = "Kore ___ hon desu.";
  assert.match(problemWithBlock({ mode: "dropdown", sentence, blanks: [{ answer: "wa" }] }) ?? "", /Blank 1 needs at least one wrong choice/);
  assert.match(problemWithBlock({ mode: "dropdown", sentence, blanks: [{ answer: "wa", distractors: ["WA"] }] }) ?? "", /wrong choice/);
  assert.equal(problemWithBlock({ mode: "dropdown", sentence, blanks: [{ answer: "wa", distractors: ["ga"] }] }), null);
});

test("a typed blank needs no wrong choices", () => {
  assert.equal(problemWithBlock({ mode: "typed", sentence: "Kore ___ hon desu.", blanks: [{ answer: "wa" }] }), null);
});

test("normalizeAnswer leaves ordinary text readable", () => {
  assert.equal(normalizeAnswer("  Arigatou   Gozaimasu。 "), "arigatou gozaimasu");
});

test("a one-line sentence is one line with no speaker", () => {
  assert.deepEqual(splitLines("Kore ___ hon desu."), [
    {
      speaker: null,
      parts: [
        { kind: "text", text: "Kore " },
        { kind: "blank", index: 0 },
        { kind: "text", text: " hon desu." },
      ],
    },
  ]);
});

test("a dialogue becomes one line per speaker, with the blank count running on", () => {
  const lines = splitLines(
    "Okyaku-san (Customer): Jyaa, ___ ha ___。\n\nTenin-san (Shopkeeper): ___ ha sakana desu。"
  );

  assert.deepEqual(lines.map((l) => l.speaker), ["Okyaku-san (Customer)", "Tenin-san (Shopkeeper)"]);
  assert.deepEqual(
    lines.flatMap((l) => l.parts.filter((p) => p.kind === "blank")),
    [{ kind: "blank", index: 0 }, { kind: "blank", index: 1 }, { kind: "blank", index: 2 }]
  );
  // the speaker's name and colon are not left in the text
  assert.equal((lines[0].parts[0] as { text: string }).text, "Jyaa, ");
});

test("empty lines and Windows line endings do not make rows", () => {
  const lines = splitLines("A: one ___\r\n\r\n\r\nB: two ___\r\n");
  assert.equal(lines.length, 2);
});

test("a colon after a blank is text, not a speaker", () => {
  const [line] = splitLines("Kore ___: desu");
  assert.equal(line.speaker, null);
});

test("splitLines agrees with countBlanks on how many blanks there are", () => {
  const sentence = "A (x): ___ and ___\nB (y): ___";
  const total = splitLines(sentence).flatMap((l) => l.parts).filter((p) => p.kind === "blank").length;
  assert.equal(total, countBlanks(sentence));
});
