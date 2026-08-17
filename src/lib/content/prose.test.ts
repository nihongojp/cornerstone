import assert from "node:assert/strict";
import test from "node:test";

import { optProse, proseToPlainText } from "./prose";
import { textToLexical } from "./textToLexical";

/*
 * `optProse` exists because of one specific regression this phase could ship
 * silently.
 *
 * The players decide whether a screen exists at all by testing the field for
 * truthiness — `if ((lesson as any).funFact)` in `LessonPlayer.tsx`. An empty
 * textarea was `""`, which is falsy, so no screen. An empty Lexical document is
 * `{ root: { children: [] } }`, which is an object, which is truthy — so every
 * lesson would gain a blank "Fun Fact" screen the moment the field type
 * changed, with nothing failing anywhere.
 */

const prose = (text: string) => textToLexical(text) as unknown as Parameters<typeof optProse>[0];

test("prose with text survives", () => {
  const value = prose("Hajimemashite.");
  assert.equal(optProse(value), value);
});

test("an empty document is absent, not an object that renders a blank screen", () => {
  assert.equal(optProse(prose("")), undefined);
  assert.equal(optProse(null), undefined);
  assert.equal(optProse(undefined), undefined);
});

test("a document holding only whitespace is absent too", () => {
  assert.equal(optProse(prose("   \n\n  ")), undefined);
  // Not reachable through textToLexical, which drops blank paragraphs — but it
  // is exactly what the editor leaves behind when an author clears a field.
  const blankParagraph = {
    root: {
      type: "root",
      children: [
        {
          type: "paragraph",
          version: 1,
          children: [
            { type: "text", text: "", version: 1, detail: 0, format: 0, mode: "normal", style: "" },
          ],
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      version: 1,
    },
  } as unknown as Parameters<typeof optProse>[0];
  assert.equal(optProse(blankParagraph), undefined);
});

test("a document whose only content is an image is present, not empty", () => {
  // Emptiness cannot be "has no text": a paragraph holding just an upload node
  // renders something, and treating it as absent would drop the image.
  const imageOnly = {
    root: {
      type: "root",
      children: [
        { type: "upload", relationTo: "media", value: 12, version: 3, format: "", fields: null },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      version: 1,
    },
  } as unknown as Parameters<typeof optProse>[0];

  assert.notEqual(optProse(imageOnly), undefined);
});

test("plain text comes back out for search and progress keys", () => {
  assert.equal(proseToPlainText(prose("One.\n\nTwo.")), "One.\n\nTwo.");
  assert.equal(proseToPlainText(null), "");
  assert.equal(proseToPlainText(undefined), "");
});
