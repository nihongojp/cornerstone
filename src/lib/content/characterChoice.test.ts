import assert from "node:assert/strict";
import test from "node:test";

import { characterChoice } from "./characterChoice";
import { textToLexical } from "./textToLexical";

const q = textToLexical("Which hiragana represents the sound “a”?");
const opts = (...labels: string[]) => labels.map((label, i) => ({ label: label.replace("*", ""), isCorrect: label.startsWith("*") || (i === 99) }));

test("a question with kana options is a character choice, with its answer and the others", () => {
  assert.deepEqual(characterChoice({ question: q, options: opts("*あ", "い", "う") }), {
    prompt: "Which hiragana represents the sound “a”?",
    answer: "あ",
    wrong: ["い", "う"],
  });
});

test("katakana and short kana runs count too", () => {
  assert.notEqual(characterChoice({ question: q, options: opts("*ア", "イ") }), null);
  assert.notEqual(characterChoice({ question: q, options: opts("*おおい", "あおい") }), null);
});

test("options that are not kana keep the list", () => {
  assert.equal(characterChoice({ question: q, options: opts("*Hello", "Goodbye", "Thanks") }), null);
  assert.equal(characterChoice({ question: q, options: opts("*あ", "i", "う") }), null);
  assert.equal(characterChoice({ question: q, options: opts("*これはほんですよ", "い") }), null);
});

test("an explanation means the list, which is where it can be shown", () => {
  assert.equal(
    characterChoice({ question: q, options: opts("*あ", "い"), explanation: textToLexical("Because…") }),
    null
  );
  // …but a blank one does not count
  assert.notEqual(characterChoice({ question: q, options: opts("*あ", "い"), explanation: textToLexical("…") }), null);
});

test("it needs exactly one right answer, a question, and two or three options", () => {
  assert.equal(characterChoice({ question: q, options: opts("あ", "い", "う") }), null);
  assert.equal(characterChoice({ question: q, options: opts("*あ", "*い", "う") }), null);
  assert.equal(characterChoice({ question: q, options: opts("*あ") }), null);
  assert.equal(characterChoice({ question: q, options: opts("*あ", "い", "う", "え") }), null);
  assert.equal(characterChoice({ question: textToLexical(""), options: opts("*あ", "い") }), null);
  assert.equal(characterChoice({ question: q, options: null }), null);
});
