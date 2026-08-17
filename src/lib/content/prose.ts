import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";

import type { Lesson } from "../../payload/payload-types";

/*
 * Reading a rich-text field, on either side of the wire.
 *
 * Same job `media.ts` does for uploads, and deliberately the same constraint:
 * no `server-only`. `adapters.ts` imports this and runs in the browser, because
 * the Live Preview wrappers re-run the adapters on the document `useLivePreview`
 * streams in. Keep this file free of imports that do not work there.
 *
 * ── Why `optProse` is not just a null check ──────────────────────────────────
 *
 * The players decide whether a screen exists by testing the field for
 * truthiness — `if ((lesson as any).funFact)` in `LessonPlayer.tsx`, and the
 * same shape in three other places. An empty textarea was `""`: falsy, no
 * screen. An empty Lexical document is `{ root: { children: [] } }`: an object,
 * truthy, one blank screen per lesson, with nothing failing anywhere to say so.
 *
 * So absence has to be decided on content rather than on the value being
 * present, which is what `optProse` does — the rich-text equivalent of
 * `optText` in `adapters.ts`, and of `resolveMedia` returning null for an unset
 * relationship. Absence is the signal; the shape of the absence differs per
 * field type.
 */

/**
 * A rich-text value, taken from the generated types rather than redeclared, so
 * it cannot drift from what Payload actually stores.
 */
export type Prose = NonNullable<Lesson["funFact"]>;

/**
 * Plain text for the things that genuinely need a string: the resource search
 * filter, and `stepKeyForItem`, which keys learner progress off the first 40
 * characters of a break's copy.
 *
 * This is Payload's own converter, which joins paragraphs with a blank line and
 * soft breaks with a newline — the exact inverse of `textToLexical`, asserted in
 * `textToLexical.roundtrip.test.ts`. That matters for progress keys: a step key
 * derived from the converted document has to match the one derived from the text
 * it was migrated from, or every learner mid-lesson loses their place.
 */
export function proseToPlainText(value: Prose | null | undefined): string {
  if (!value) return "";
  return convertLexicalToPlaintext({ data: value as never });
}

/**
 * The document, or `undefined` when there is nothing to render.
 *
 * "Nothing to render" is no text *and* no nodes that render without text —
 * a paragraph containing only an image is not empty. Checking the text alone
 * would silently drop an image-only callout.
 */
export function optProse(value: Prose | null | undefined): Prose | undefined {
  if (!value) return undefined;
  if (proseToPlainText(value).trim() !== "") return value;

  /*
   * No text. Only absent if there is also nothing else — the editor leaves a
   * single empty paragraph behind when an author clears a field, and that has
   * to read as empty, while an upload or a block node has to read as present.
   */
  const children = Array.isArray(value.root?.children) ? value.root.children : [];
  const renders = children.some((child) => hasRenderableNode(child));
  return renders ? value : undefined;
}

/** A node that shows something without contributing text. */
function hasRenderableNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const type = (node as { type?: unknown }).type;
  if (type === "paragraph" || type === "root" || type === "text" || type === "linebreak") {
    const children = (node as { children?: unknown }).children;
    return Array.isArray(children) && children.some((child) => hasRenderableNode(child));
  }
  // Anything else — an upload, a block, a horizontal rule — renders on its own.
  return typeof type === "string" && type !== "";
}
