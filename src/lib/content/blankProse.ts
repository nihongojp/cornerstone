import type { Lesson } from "../../payload/payload-types";
import { hasRenderableNode, proseToPlainText, type Prose } from "./prose";

type Block = NonNullable<NonNullable<Lesson["steps"]>[number]["components"]>[number];

/*
 * Dots, ellipses and spaces — what an author types to hold a place ("…", "...",
 * "。。。") before the real text is written. A Fun Fact holding only these is the
 * same as an empty one: a screen with a heading and nothing to read.
 */
const PLACEHOLDER_CHARACTERS = /[\s.…‥・。]/gu;

/**
 * True when there is nothing worth showing: no document, no text, or only
 * placeholder dots. An image, upload or other block counts as content even with no
 * text beside it.
 */
export function isBlankProse(value: Prose | null | undefined): boolean {
  if (!value) return true;
  if (proseToPlainText(value).replace(PLACEHOLDER_CHARACTERS, "") !== "") return false;

  const children = Array.isArray(value.root?.children) ? value.root.children : [];
  return !children.some((child) => hasRenderableNode(child));
}

/** A "fact" prose block with nothing in it. */
export function isBlankFunFact(block: Block): boolean {
  return block.blockType === "prose" && block.tone === "fact" && isBlankProse(block.content);
}

/**
 * A step made only of blank Fun Fact blocks — a screen that would show a heading
 * over an empty box. A step with anything else on it is not skipped; its blank fun
 * fact is just left out (see `ProseView`).
 */
export function isEmptyFunFactStep(components: readonly Block[] | null | undefined): boolean {
  return Boolean(components?.length) && (components ?? []).every(isBlankFunFact);
}
