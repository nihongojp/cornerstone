import assert from "node:assert/strict";
import test from "node:test";

import type { Field, Payload } from "payload";

import { fromPortable, toPortable, type BrokenRef } from "./snapshot";

/*
 * References inside rich text.
 *
 * The rest of the snapshot walker is driven by the collection's field schema, and
 * that carried Phases 1 and 2 with no changes here at all. Rich text is where it
 * stopped being free: a Lexical document holds its own upload and relationship
 * nodes, below the level the field schema describes, so without the `richText`
 * case those references are written out as bare serial integers — which import
 * into a different database as whatever document happens to hold that id.
 *
 * Nothing fails when that happens, which is why it is tested here rather than
 * checked by eye. `toPortable` reads only `payload.collections[x].config.fields`,
 * so a field list is the whole fixture.
 */

const payloadWith = (fields: Field[]): Payload =>
  ({ collections: { lessons: { config: { fields } } } }) as unknown as Payload;

/** One `richText` field called `content`, which is the shape four blocks have. */
const proseSchema = payloadWith([
  { name: "slug", type: "text" },
  { name: "content", type: "richText" },
]);

const doc = (children: unknown[]) => ({
  slug: "l1-v1",
  content: { root: { type: "root", children, direction: "ltr", format: "", indent: 0, version: 1 } },
});

/** The node an author produces by picking an image from the toolbar. */
const uploadNode = (value: unknown) => ({
  type: "upload",
  relationTo: "media",
  value,
  fields: { caption: "A cat" },
  version: 3,
  format: "",
});

/** The node an author produces with the Term inline block. */
const termRefNode = (term: unknown) => ({
  type: "inlineBlock",
  version: 1,
  fields: { blockType: "termRef", id: "abc", term, display: "furigana", showAudio: true },
});

const contentOf = (portable: Record<string, unknown>): { root: { children: unknown[] } } =>
  portable.content as { root: { children: unknown[] } };

test("an image dropped into a paragraph travels as its filename", () => {
  const broken: BrokenRef[] = [];
  const portable = toPortable(
    proseSchema,
    "lessons",
    doc([
      { type: "paragraph", version: 1, children: [uploadNode({ id: 12, filename: "neko.png" })] },
    ]),
    broken
  );

  assert.deepEqual(broken, []);
  const paragraph = contentOf(portable).root.children[0] as { children: Array<{ value: unknown }> };
  assert.deepEqual(paragraph.children[0].value, { $ref: "neko.png", $collection: "media" });
});

test("a termRef inside prose travels as the term's key", () => {
  const broken: BrokenRef[] = [];
  const portable = toPortable(
    proseSchema,
    "lessons",
    doc([
      {
        type: "paragraph",
        version: 1,
        children: [termRefNode({ id: 5, key: "hajimemashite" })],
      },
    ]),
    broken
  );

  assert.deepEqual(broken, []);
  const paragraph = contentOf(portable).root.children[0] as {
    children: Array<{ fields: { term: unknown } }>;
  };
  assert.deepEqual(paragraph.children[0].fields.term, {
    $ref: "hajimemashite",
    $collection: "terms",
  });
});

test("a termRef nested in a block's own rich text is reached too", () => {
  // `callout.content` and `exampleSentence.japanese` are richText fields inside a
  // Lexical block, so a term reference can sit two editors deep. The walk has to
  // recurse through both.
  const broken: BrokenRef[] = [];
  const portable = toPortable(
    proseSchema,
    "lessons",
    doc([
      {
        type: "block",
        version: 2,
        format: "",
        fields: {
          blockType: "callout",
          id: "cal",
          blockName: "",
          tone: "note",
          content: {
            root: {
              type: "root",
              direction: "ltr",
              format: "",
              indent: 0,
              version: 1,
              children: [
                {
                  type: "paragraph",
                  version: 1,
                  children: [termRefNode({ id: 9, key: "yoroshiku" })],
                },
              ],
            },
          },
        },
      },
    ]),
    broken
  );

  assert.deepEqual(broken, []);
  const callout = contentOf(portable).root.children[0] as {
    fields: { content: { root: { children: Array<{ children: Array<{ fields: { term: unknown } }> }> } } };
  };
  assert.deepEqual(callout.fields.content.root.children[0].children[0].fields.term, {
    $ref: "yoroshiku",
    $collection: "terms",
  });
});

test("an unpopulated reference in prose stops the export instead of shipping an id", () => {
  const broken: BrokenRef[] = [];
  toPortable(
    proseSchema,
    "lessons",
    doc([{ type: "paragraph", version: 1, children: [uploadNode(12)] }]),
    broken
  );

  assert.equal(broken.length, 1);
  assert.match(broken[0].detail, /came back unpopulated/);
});

test("a block slug the walker does not know stops the export", () => {
  // The failure this guards: someone adds a Lexical block with a relationship in
  // it, forgets these arrays, and every reference inside it silently ships as an
  // integer. Passing an unknown block through would be exactly that.
  const broken: BrokenRef[] = [];
  toPortable(
    proseSchema,
    "lessons",
    doc([
      {
        type: "block",
        version: 2,
        format: "",
        fields: { blockType: "notRegistered", id: "x", blockName: "", term: 4 },
      },
    ]),
    broken
  );

  assert.equal(broken.length, 1);
  assert.match(broken[0].detail, /not in PROSE_BLOCKS/);
});

test("a relationship node with no relationTo stops the export", () => {
  const broken: BrokenRef[] = [];
  toPortable(
    proseSchema,
    "lessons",
    doc([{ type: "paragraph", version: 1, children: [{ type: "upload", value: 3, version: 3 }] }]),
    broken
  );

  assert.equal(broken.length, 1);
  assert.match(broken[0].detail, /no relationTo/);
});

test("importing resolves prose references back to ids in the target database", () => {
  const unresolved: BrokenRef[] = [];
  const resolved = fromPortable(
    proseSchema,
    "lessons",
    {
      slug: "l1-v1",
      content: {
        root: {
          type: "root",
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
          children: [
            {
              type: "paragraph",
              version: 1,
              children: [
                uploadNode({ $ref: "neko.png", $collection: "media" }),
                termRefNode({ $ref: "hajimemashite", $collection: "terms" }),
              ],
            },
          ],
        },
      },
    },
    new Map([
      ["media", new Map([["neko.png", 77]])],
      ["terms", new Map([["hajimemashite", 88]])],
    ]),
    unresolved
  );

  assert.deepEqual(unresolved, []);
  const paragraph = contentOf(resolved).root.children[0] as {
    children: [{ value: unknown }, { fields: { term: unknown } }];
  };
  assert.equal(paragraph.children[0].value, 77);
  assert.equal(paragraph.children[1].fields.term, 88);
});

test("a prose reference missing from the target database stops the import", () => {
  const unresolved: BrokenRef[] = [];
  fromPortable(
    proseSchema,
    "lessons",
    doc([
      {
        type: "paragraph",
        version: 1,
        children: [termRefNode({ $ref: "gone", $collection: "terms" })],
      },
    ]),
    new Map([["terms", new Map<string, number>()]]),
    unresolved
  );

  assert.equal(unresolved.length, 1);
  assert.match(unresolved[0].detail, /no terms with key "gone"/);
});
