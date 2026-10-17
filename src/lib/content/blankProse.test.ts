import assert from "node:assert/strict";
import test from "node:test";

import type { Lesson } from "../../payload/payload-types";
import { isBlankFunFact, isBlankProse, isEmptyFunFactStep } from "./blankProse";
import type { Prose } from "./prose";
import { textToLexical } from "./textToLexical";

type Block = NonNullable<NonNullable<Lesson["steps"]>[number]["components"]>[number];

const fact = (text: string, tone = "fact") =>
  ({ blockType: "prose", tone, content: textToLexical(text) }) as unknown as Block;
const other = (blockType: string) => ({ blockType }) as unknown as Block;

test("no document at all is blank", () => {
  assert.equal(isBlankProse(null), true);
  assert.equal(isBlankProse(undefined), true);
});

test("empty text and placeholder dots are blank", () => {
  for (const text of ["", "   ", "...", "…", " . . . ", "。。。", "‥", "…\n…"]) {
    assert.equal(isBlankProse(textToLexical(text)), true, JSON.stringify(text));
  }
});

test("real text is not blank, even with dots around it", () => {
  assert.equal(isBlankProse(textToLexical("Cats purr")), false);
  assert.equal(isBlankProse(textToLexical("...and then")), false);
  assert.equal(isBlankProse(textToLexical("ひらがな")), false);
});

test("an image or other block is content even with no text", () => {
  const withUpload = {
    root: { type: "root", children: [{ type: "upload", value: 1 }], direction: null, format: "", indent: 0, version: 1 },
  } as unknown as Prose;
  assert.equal(isBlankProse(withUpload), false);
});

test("only a fact-tone prose block can be a blank fun fact", () => {
  assert.equal(isBlankFunFact(fact("…")), true);
  assert.equal(isBlankFunFact(fact("Cats purr")), false);
  assert.equal(isBlankFunFact(fact("…", "card")), false);
  assert.equal(isBlankFunFact(other("dialogue")), false);
});

test("a step of only blank fun facts is skipped; one with anything else is not", () => {
  assert.equal(isEmptyFunFactStep([fact("…")]), true);
  assert.equal(isEmptyFunFactStep([fact("…"), fact("")]), true);
  assert.equal(isEmptyFunFactStep([fact("…"), other("dialogue")]), false);
  assert.equal(isEmptyFunFactStep([fact("Cats purr")]), false);
  assert.equal(isEmptyFunFactStep([]), false);
  assert.equal(isEmptyFunFactStep(null), false);
});
