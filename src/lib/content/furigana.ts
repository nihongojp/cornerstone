import type { Term } from "../../payload/payload-types";

/*
 * What a `termRef` inline block actually shows.
 *
 * Kept out of the renderer so it can be tested without one, because every way
 * this goes wrong is silent: a term with no Japanese script renders as a gap in
 * the middle of a sentence, an okurigana segment emits an empty `<rt>` that
 * still takes up a line of height, and an unpopulated relationship renders its
 * own database id.
 *
 * ── The fallback chain is the common path, not the edge case ─────────────────
 *
 * 24 of the 41 seeded terms have no Japanese script — the imported content is
 * romaji only, "Hajimemashite" and never はじめまして (see
 * `docs/content-backlog.md`). So every display mode falls back rather than
 * rendering nothing: a sentence with a hole in it is worse than one showing the
 * romaji, and `npm run content:verify` reports the gap as an editorial to-do so
 * the fallback does not hide the backlog.
 *
 * Deliberately free of `server-only` — the players are client components, and
 * `adapters.ts` runs in the browser for Live Preview.
 */

/** The fields a `termRef` reads. A `Pick` so it cannot drift from the schema. */
export type TermLike = Pick<
  Term,
  "furigana" | "japanese" | "katakana" | "key" | "meaning" | "reading" | "romaji"
>;

/** Which form of the term to show — mirrors `display` on the `termRef` block. */
export type TermDisplay = "furigana" | "meaning" | "plain" | "reading" | "romaji";

/** One base/reading pair. `ruby` absent means this part takes no reading. */
export type RubySegment = { base: string; ruby?: string };

export type RenderableTerm =
  | { kind: "ruby"; segments: RubySegment[] }
  | { kind: "text"; text: string }
  | null;

function text(value: string | null | undefined): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * The written form. A kana entry shows both scripts joined — this is what the
 * old `"あ/ア"` strings encoded with a slash, except the delimiter is now the
 * renderer's decision rather than the schema's.
 */
function written(term: TermLike): string | undefined {
  const japanese = text(term.japanese);
  const katakana = text(term.katakana);
  if (japanese && katakana) return `${japanese} / ${katakana}`;
  return japanese ?? katakana;
}

/** Falls through to whatever the term actually has, ending at the key. */
function firstAvailable(term: TermLike, ...preferred: Array<string | undefined>): string {
  return (
    preferred.find((value) => value !== undefined) ??
    written(term) ??
    text(term.reading) ??
    text(term.romaji) ??
    text(term.meaning) ??
    term.key
  );
}

/**
 * What to render for a term, or `null` when there is nothing to render.
 *
 * `null` covers the unpopulated case: a bare id means the read did not ask for
 * enough `depth`, and it is the same silent failure `resolveMedia` guards
 * against — see `lib/content/depth.ts`.
 */
export function renderableTerm(
  value: TermLike | number | null | undefined,
  display: TermDisplay
): RenderableTerm {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return null;
  const term = value;

  if (display === "furigana") {
    const segments = rubySegments(term);
    if (segments) return { kind: "ruby", segments };
    // No script to put a reading over — fall through to the plain forms.
  }

  switch (display) {
    case "reading":
      return { kind: "text", text: firstAvailable(term, text(term.reading)) };
    case "romaji":
      return { kind: "text", text: firstAvailable(term, text(term.romaji)) };
    case "meaning":
      return { kind: "text", text: firstAvailable(term, text(term.meaning)) };
    default:
      return { kind: "text", text: firstAvailable(term) };
  }
}

/**
 * The term's written form split into ruby segments, or `null` when there is no
 * ruby to show.
 *
 * `null` rather than a single reading-less segment: a `<ruby>` with nothing in
 * its `<rt>` still reserves the line height above the text, so a word with no
 * readings has to render as ordinary text instead.
 */
function rubySegments(term: TermLike): RubySegment[] | null {
  const authored = Array.isArray(term.furigana) ? term.furigana : [];
  const segments: RubySegment[] = authored.flatMap((segment) => {
    const base = text(segment.base);
    if (!base) return [];
    const ruby = text(segment.ruby);
    return [ruby ? { base, ruby } : { base }];
  });

  if (segments.length) {
    return segments.some((segment) => segment.ruby !== undefined) ? segments : null;
  }

  // Nothing authored: the whole word takes its reading as one ruby. This is the
  // case for every term seeded from the import — `furigana` segments have to be
  // split by hand and none have been yet.
  const base = written(term);
  const reading = text(term.reading);
  if (base && reading && base !== reading) return [{ base, ruby: reading }];
  return null;
}
