import { renderableTerm, type TermDisplay, type TermLike } from "@/lib/content/furigana";
import { mediaSrc, renderableImage } from "@/lib/content/media";
import type { Term } from "@/payload/payload-types";

/*
 * Reading a referenced term for the exercise blocks.
 *
 * The blocks in `payload/blocks/library.ts` reference `terms` rather than
 * carrying their own copy of a word, so every renderer needs the same three
 * things out of a relationship: the text to show, the audio to play, the picture
 * to show. That is all this is.
 *
 * `renderableTerm` in `lib/content/furigana.ts` owns the fallback chain — 24 of
 * 41 terms have no Japanese script, so "show the written form" genuinely means
 * "the written form, or the reading, or the romaji, or the key". This flattens
 * its result to a string for the components that take strings; anything wanting
 * real furigana uses `renderableTerm` directly and renders `<Ruby>`.
 */

/** A populated term, or null when the relationship did not populate. */
export function term(value: Term | number | null | undefined): Term | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return null;
  return value;
}

/**
 * One line of text for a term, in the requested form.
 *
 * Empty string rather than null: every consumer here is a component prop that is
 * already a string, and an empty one renders as nothing, which is the right
 * outcome for an unpopulated relationship.
 */
export function termText(
  value: Term | number | null | undefined,
  display: TermDisplay = "plain"
): string {
  const rendered = renderableTerm(value as TermLike | number | null | undefined, display);
  if (!rendered) return "";
  // A ruby result is segments; joining the bases gives the written form without
  // the readings, which is what a plain string can carry.
  return rendered.kind === "text"
    ? rendered.text
    : rendered.segments.map((segment) => segment.base).join("");
}

/** The term's pronunciation, or undefined. */
export function termAudio(value: Term | number | null | undefined): string | undefined {
  return mediaSrc(term(value)?.audio);
}

/** The term's picture at card size, or undefined. */
export function termImage(value: Term | number | null | undefined): string | undefined {
  return renderableImage(term(value)?.image, "card")?.src;
}
