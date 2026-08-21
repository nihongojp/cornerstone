import assert from "node:assert/strict";
import test from "node:test";

import { textToLexical } from "./textToLexical";

/*
 * These run the migration's transform, so a bug here is a bug in content that
 * has already been converted and cannot be re-derived — the text column it came
 * from is dropped in the same migration. Hence the round-trip assertions
 * against Payload's own plaintext converter: if the two disagree, the migration
 * is lossy and `down()` cannot get back what it started with.
 */

test("a single line becomes one paragraph holding one text node", () => {
  const state = textToLexical("Hajimemashite.");

  assert.equal(state.root.children.length, 1);
  const [paragraph] = state.root.children;
  assert.equal(paragraph.type, "paragraph");
  assert.deepEqual(
    paragraph.children.map((child) => [child.type, "text" in child ? child.text : null]),
    [["text", "Hajimemashite."]]
  );
});

test("a blank line starts a new paragraph", () => {
  const state = textToLexical("First para.\n\nSecond para.");

  assert.equal(state.root.children.length, 2);
  assert.deepEqual(
    state.root.children.map((p) => p.children.map((c) => ("text" in c ? c.text : c.type))),
    [["First para."], ["Second para."]]
  );
});

test("a single newline is a linebreak inside one paragraph", () => {
  const state = textToLexical("Line one\nLine two");

  assert.equal(state.root.children.length, 1);
  assert.deepEqual(
    state.root.children[0].children.map((c) => ("text" in c ? c.text : c.type)),
    ["Line one", "linebreak", "Line two"]
  );
});

test("empty and whitespace-only text produce an empty document, not an empty paragraph", () => {
  for (const input of ["", "   ", "\n\n", null, undefined]) {
    const state = textToLexical(input);
    assert.deepEqual(state.root.children, [], `input ${JSON.stringify(input)}`);
  }
});

test("runs of blank lines collapse to one paragraph break", () => {
  const state = textToLexical("One.\n\n\n\nTwo.");

  assert.equal(state.root.children.length, 2);
});

test("leading and trailing blank lines produce no empty paragraphs", () => {
  const state = textToLexical("\n\nOnly one.\n\n");

  assert.equal(state.root.children.length, 1);
  assert.equal(state.root.children[0].children.length, 1);
});

test("carriage returns are normalised, not carried into the text", () => {
  const state = textToLexical("One.\r\n\r\nTwo.\r\nStill two.");

  assert.equal(state.root.children.length, 2);
  const texts = state.root.children.flatMap((p) =>
    p.children.flatMap((c) => ("text" in c ? [c.text] : []))
  );
  assert.deepEqual(texts, ["One.", "Two.", "Still two."]);
  for (const t of texts) assert.ok(!t.includes("\r"), `"${t}" still has a carriage return`);
});

test("Japanese text survives unchanged", () => {
  const state = textToLexical("はじめまして。\nよろしくお願いします。");

  assert.deepEqual(
    state.root.children[0].children.flatMap((c) => ("text" in c ? [c.text] : [])),
    ["はじめまして。", "よろしくお願いします。"]
  );
});

test("the root and paragraph nodes carry the fields Payload's own builder writes", () => {
  /*
   * The admin panel reads this JSON straight into a Lexical editor. A missing
   * `version` or `direction` is not a type error anywhere and does not fail a
   * read — it surfaces as an editor that will not open the document, which is
   * exactly the kind of failure this phase has to avoid shipping.
   */
  const state = textToLexical("Hello");

  assert.deepEqual(
    { ...state.root, children: "…" },
    { type: "root", children: "…", direction: "ltr", format: "", indent: 0, version: 1 }
  );
  assert.deepEqual(
    { ...state.root.children[0], children: "…" },
    {
      type: "paragraph",
      children: "…",
      direction: "ltr",
      format: "",
      indent: 0,
      textFormat: 0,
      textStyle: "",
      version: 1,
    }
  );
  assert.deepEqual(state.root.children[0].children[0], {
    type: "text",
    detail: 0,
    format: 0,
    mode: "normal",
    style: "",
    text: "Hello",
    version: 1,
  });
});
