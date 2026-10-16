import { seededShuffle } from "./shuffle";

/*
 * Fill-in-the-blank, as pure functions — no React, no Payload — so the admin's
 * validation, the player and `npm run content:verify` all ask the same questions
 * of the same code, and a test can pin them.
 *
 * ── How a sentence and its blanks line up ───────────────────────────────────
 *
 * The author writes the sentence with `___` (three or more underscores) wherever
 * a word goes, and lists the blanks below it *in the order they appear*: the first
 * `___` is the first row, the second `___` the second. Position is the only link,
 * which is why `problemWithBlock` insists the counts match — a sentence with three
 * blanks and two rows would otherwise ship with one blank that can never be right.
 */

export type FillInBlankMode = "dropdown" | "typed";

export type BlankSpec = {
  answer: string;
  /** Typed mode: other spellings that are also right (romaji, hiragana, …). */
  alsoAccept?: readonly string[] | null;
  /** Dropdown mode: the wrong choices offered beside the answer. */
  distractors?: readonly string[] | null;
};

export type SentencePart = { kind: "text"; text: string } | { kind: "blank"; index: number };

const BLANK_MARKER = /_{3,}/g;

/**
 * The sentence cut into the text between blanks and the blanks themselves.
 * `firstIndex` is the number the first blank gets, for a sentence that is one line
 * of several (see `splitLines`).
 */
export function splitSentence(sentence: string, firstIndex = 0): SentencePart[] {
  const parts: SentencePart[] = [];
  let last = 0;
  let index = firstIndex;

  for (const match of sentence.matchAll(BLANK_MARKER)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", text: sentence.slice(last, start) });
    parts.push({ kind: "blank", index: index++ });
    last = start + match[0].length;
  }
  if (last < sentence.length) parts.push({ kind: "text", text: sentence.slice(last) });

  return parts;
}

export type SentenceLine = {
  /** Who is speaking, when the line starts "Name (Role): …" — otherwise null. */
  speaker: string | null;
  parts: SentencePart[];
};

// "Tenin-san (Shopkeeper): …" — a short label, then a colon. A blank is never part
// of the label, so "Kore ___: …" is not read as a speaker.
const SPEAKER = /^([^:：_\r\n]{1,40}?)\s*[:：]\s*(.*)$/;
const LINE_BREAK = /\r?\n/;

/**
 * The sentence as lines, for a dialogue. Each non-empty line is its own row, and a
 * "Name:" at the start becomes the speaker. Blank numbering runs on across the
 * lines, so the first `___` anywhere is blank 0 whichever line it is on — the
 * same order the rows below the sentence are written in. A single sentence with
 * no line breaks comes back as one line with no speaker.
 */
export function splitLines(sentence: string): SentenceLine[] {
  const lines: SentenceLine[] = [];
  let next = 0;

  for (const raw of sentence.split(LINE_BREAK)) {
    const text = raw.trim();
    if (!text) continue;

    const match = SPEAKER.exec(text);
    const speaker = match ? match[1].trim() : null;
    const body = match ? match[2] : text;

    const parts = splitSentence(body, next);
    next += parts.filter((p) => p.kind === "blank").length;
    lines.push({ speaker: speaker || null, parts });
  }

  return lines;
}

export function countBlanks(sentence: string): number {
  return (sentence.match(BLANK_MARKER) ?? []).length;
}

/**
 * What typed answers are compared as: full-width forms folded to normal ones,
 * case and surrounding space ignored, inner runs of space collapsed, and a
 * trailing full stop or "。" dropped — a learner who types "desu." has not got it
 * wrong. Hiragana and katakana are deliberately *not* folded into each other: they
 * are different answers, and the author can list both under `alsoAccept`.
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.。!！?？]+$/u, "")
    .trim()
    .toLowerCase();
}

function accepted(blank: BlankSpec): string[] {
  return [blank.answer, ...(blank.alsoAccept ?? [])].map(normalizeAnswer).filter(Boolean);
}

/** Typed: any accepted spelling. Dropdown: the one answer. Empty is never right. */
export function isBlankCorrect(given: string, blank: BlankSpec): boolean {
  const value = normalizeAnswer(given);
  return value !== "" && accepted(blank).includes(value);
}

/** One verdict per blank, in order. A blank the learner left empty is wrong. */
export function gradeBlanks(given: readonly string[], blanks: readonly BlankSpec[]): boolean[] {
  return blanks.map((blank, i) => isBlankCorrect(given[i] ?? "", blank));
}

/**
 * The dropdown's choices: the answer and the wrong choices, each once, in an order
 * that is the same on the server and in the browser. `Math.random` here would
 * give the server one order and hydration another — see `shuffle.ts`.
 */
export function dropdownChoices(blank: BlankSpec, seed: string): string[] {
  const seen = new Set<string>();
  const choices: string[] = [];
  for (const choice of [blank.answer, ...(blank.distractors ?? [])]) {
    const key = normalizeAnswer(choice);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    choices.push(choice);
  }
  return seededShuffle(choices, seed);
}

/**
 * What is wrong with an authored block, in words an author can act on, or null.
 * Run by the admin when a lesson is saved and again by `npm run content:verify`
 * over what is already published.
 */
export function problemWithBlock(block: {
  mode?: string | null;
  sentence?: string | null;
  blanks?: readonly BlankSpec[] | null;
}): string | null {
  const sentence = block.sentence ?? "";
  const blanks = block.blanks ?? [];
  const found = countBlanks(sentence);

  if (found === 0) {
    return "The sentence needs at least one blank, written as ___ (three underscores).";
  }
  if (found !== blanks.length) {
    return (
      `The sentence has ${found} blank${found === 1 ? "" : "s"} (___) but ${blanks.length} ` +
      `row${blanks.length === 1 ? "" : "s"} below. They have to match, in the order they appear.`
    );
  }

  for (const [i, blank] of blanks.entries()) {
    const label = `Blank ${i + 1}`;
    if (!blank.answer?.trim()) return `${label} has no answer.`;

    if (block.mode === "dropdown") {
      const wrong = (blank.distractors ?? []).filter(
        (d) => d.trim() && normalizeAnswer(d) !== normalizeAnswer(blank.answer)
      );
      if (wrong.length === 0) {
        return `${label} needs at least one wrong choice, or the dropdown has nothing to choose between.`;
      }
    }
  }

  return null;
}
