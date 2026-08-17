/*
 * Plain text → a Lexical document, for the one-time conversion of the nine
 * prose fields that were `textarea`s.
 *
 * A pure function on purpose. The migration that turns those `text` columns
 * into `jsonb` calls it row by row (see
 * `payload/migrations/*_richtext_prose.ts`), which is the only way to do that
 * backfill honestly: Payload generates the ADD and the DROP and nothing in
 * between, and generating Lexical JSON in SQL would mean reimplementing the
 * paragraph splitting in plpgsql. A TypeScript migration can just call this.
 *
 * The reason it is tested rather than eyeballed: the text column is dropped in
 * the same migration, so a bug here is unrecoverable content. The tests assert
 * the node shapes Payload's own `buildEditorState` writes, because a document
 * missing `version` or `direction` reads back fine and then refuses to open in
 * the editor.
 *
 * Not `server-only` — nothing here touches a database, and the round-trip test
 * runs it under `node:test` outside Next entirely.
 *
 * The inverse is `convertLexicalToPlaintext` from
 * `@payloadcms/richtext-lexical/plaintext`, which joins paragraphs with a blank
 * line and linebreaks with a newline — exactly the split below, reversed.
 * `textToLexical.test.ts` asserts the round trip rather than trusting that.
 */

export type LexicalTextNode = {
  type: "text";
  detail: 0;
  format: 0;
  mode: "normal";
  style: "";
  text: string;
  version: 1;
};

export type LexicalLinebreakNode = { type: "linebreak"; version: 1 };

export type LexicalParagraphNode = {
  type: "paragraph";
  children: Array<LexicalLinebreakNode | LexicalTextNode>;
  direction: "ltr";
  format: "";
  indent: 0;
  textFormat: 0;
  textStyle: "";
  version: 1;
};

/**
 * The subset of a Lexical document this produces: paragraphs of text and
 * linebreaks, nothing else. Narrower than Payload's `SerializedEditorState` so
 * that the tests can reach into it without narrowing a union on every access,
 * and so the shape is legible here rather than inferred from a generic.
 */
export type PlainTextLexical = {
  root: {
    type: "root";
    children: LexicalParagraphNode[];
    direction: "ltr";
    format: "";
    indent: 0;
    version: 1;
  };
};

function textNode(text: string): LexicalTextNode {
  return { type: "text", detail: 0, format: 0, mode: "normal", style: "", text, version: 1 };
}

function paragraphNode(lines: string[]): LexicalParagraphNode {
  const children: LexicalParagraphNode["children"] = [];
  lines.forEach((line, index) => {
    // Positional, not separator-joined: the linebreak is a node between two
    // text nodes, which is how Lexical represents a soft break.
    if (index > 0) children.push({ type: "linebreak", version: 1 });
    children.push(textNode(line));
  });
  return {
    type: "paragraph",
    children,
    direction: "ltr",
    format: "",
    indent: 0,
    textFormat: 0,
    textStyle: "",
    version: 1,
  };
}

/**
 * Split on blank lines into paragraphs, and on single newlines into soft breaks
 * within a paragraph.
 *
 * Empty in, empty out — a document with **no** children rather than one empty
 * paragraph. Payload's `hasText` treats a lone empty paragraph as content, so
 * an empty textarea would otherwise become a field that looks filled and
 * renders a blank line.
 */
export function textToLexical(text: string | null | undefined): PlainTextLexical {
  const root: PlainTextLexical["root"] = {
    type: "root",
    children: [],
    direction: "ltr",
    format: "",
    indent: 0,
    version: 1,
  };

  const normalised = (text ?? "").replace(/\r\n?/g, "\n");

  for (const block of normalised.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length) root.children.push(paragraphNode(lines));
  }

  return { root };
}
