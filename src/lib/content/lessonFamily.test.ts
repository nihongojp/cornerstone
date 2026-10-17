import assert from "node:assert/strict";
import test from "node:test";

import { isGrammarLesson } from "./lessonFamily";

test("grammar slugs are grammar lessons", () => {
  assert.equal(isGrammarLesson("grammar-l1-v1"), true);
  assert.equal(isGrammarLesson("grammar-l3-v3"), true);
});

test("reading/writing slugs are not", () => {
  assert.equal(isGrammarLesson("hiragana-l1-v1-hokkaido"), false);
  assert.equal(isGrammarLesson("hiragana-l3-v2-iwate"), false);
});

test("only the family at the start counts, and a missing slug is not grammar", () => {
  assert.equal(isGrammarLesson("zz-grammar-l1-v1"), false);
  assert.equal(isGrammarLesson("grammarish-l1"), false);
  assert.equal(isGrammarLesson(""), false);
  assert.equal(isGrammarLesson(null), false);
  assert.equal(isGrammarLesson(undefined), false);
});
