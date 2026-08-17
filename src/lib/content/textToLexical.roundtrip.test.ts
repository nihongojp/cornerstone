import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";

import { textToLexical } from "./textToLexical";

/*
 * The migration drops the `text` column it read from, so `textToLexical` is the
 * only thing standing between the authored copy and losing it. These are the
 * assertions that make that safe to do:
 *
 *  1. Payload's own `convertLexicalToPlaintext` is the inverse. The migration's
 *     `down()` uses it, so if the two disagree the rollback is lossy — and this
 *     is an assumption about a third-party function on a pinned version, which
 *     makes it exactly the kind of thing to pin down with a test rather than
 *     read once in the source.
 *  2. Converting is stable: text that has already been through the transform
 *     round-trips to the identical document. Without that, `up()` after a
 *     `down()` would drift.
 *  3. No characters are dropped, over the real corpus rather than invented
 *     examples.
 */

const plain = (text: string | null | undefined): string =>
  // The converter's argument type is Payload's full SerializedEditorState; the
  // narrower shape this produces is a subset of it.
  convertLexicalToPlaintext({ data: textToLexical(text) as never });

test("Payload's plaintext converter is the inverse, for text already in normal form", () => {
  const cases = [
    "Hajimemashite.",
    "First para.\n\nSecond para.",
    "Line one\nLine two",
    "One.\nTwo.\n\nThree.",
    "はじめまして。\nよろしくお願いします。",
    "A single paragraph that happens to be quite a lot longer than the others, to no effect.",
  ];

  for (const input of cases) {
    assert.equal(plain(input), input);
  }
});

test("empty text converts to an empty string, not a blank paragraph", () => {
  for (const input of ["", "   ", "\n\n", null, undefined]) {
    assert.equal(plain(input), "", `input ${JSON.stringify(input)}`);
  }
});

test("converting is stable — a second pass produces the identical document", () => {
  for (const input of corpus()) {
    const once = textToLexical(input);
    const twice = textToLexical(convertLexicalToPlaintext({ data: once as never }));
    assert.deepEqual(twice, once, `not stable for ${JSON.stringify(input.slice(0, 60))}`);
  }
});

test("no non-whitespace character is lost, over the real content corpus", () => {
  const strings = corpus();
  // A canary: if the snapshot ever stops carrying prose, this test would pass
  // by testing nothing at all.
  assert.ok(strings.length > 50, `expected real prose in the snapshot, found ${strings.length}`);

  for (const input of strings) {
    const stripped = (s: string) => s.replace(/\s+/g, "");
    assert.equal(
      stripped(plain(input)),
      stripped(input),
      `characters changed for ${JSON.stringify(input.slice(0, 60))}`
    );
  }
});

/**
 * Every multi-line or substantial string in the content snapshot — a superset of
 * the nine fields being converted, which is the point: it does not depend on
 * knowing where prose lives, so it keeps covering the corpus as the schema moves.
 */
function corpus(): string[] {
  const dir = path.resolve("content/snapshot");
  const out: string[] = [];

  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      if (node.includes("\n") || node.length > 40) out.push(node);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") return Object.values(node).forEach(walk);
  };

  for (const file of ["lessons.json", "courses.json", "resources.json", "terms.json"]) {
    walk(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
  }
  return out;
}
