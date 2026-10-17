import { isBlankProse } from "./blankProse";
import { proseToPlainText, type Prose } from "./prose";

/*
 * Whether a multiple-choice is really "pick the character" — and so should play as
 * Part 1's "listen and choose the character" screen (three big boxes in a row, a
 * tick or a cross the moment one is tapped) instead of a vertical list of lines.
 *
 * "Which hiragana represents the sound “a”?" with あ / い / う is that exercise;
 * "What does this sentence mean?" with three sentences is not, and keeps the list.
 * The test is on the options, not on a flag, so a character question authored as a
 * plain multiple-choice gets the right screen without anyone re-authoring it.
 *
 * It declines — returns null, and the list is used — whenever the block holds
 * something the three-box screen has no place for: an explanation, a missing or
 * doubled answer, or options that are not short runs of kana.
 */

const KANA_ONLY = /^[\u3040-\u309f\u30a0-\u30ff]{1,4}$/;

export type CharacterChoice = {
  prompt: string;
  /** The right character. */
  answer: string;
  /** The others, as authored. */
  wrong: string[];
};

export function characterChoice(block: {
  question?: Prose | null;
  options?: readonly { label: string; isCorrect?: boolean | null }[] | null;
  explanation?: Prose | null;
}): CharacterChoice | null {
  const options = (block.options ?? []).map((o) => ({ label: o.label?.trim() ?? "", isCorrect: o.isCorrect === true }));

  // Two or three boxes fit in a row; the screen shows at most the answer and two others.
  if (options.length < 2 || options.length > 3) return null;
  if (!options.every((o) => KANA_ONLY.test(o.label))) return null;
  if (!isBlankProse(block.explanation)) return null;

  const correct = options.filter((o) => o.isCorrect);
  if (correct.length !== 1) return null;

  const prompt = proseToPlainText(block.question).trim();
  if (!prompt) return null;

  return { prompt, answer: correct[0].label, wrong: options.filter((o) => !o.isCorrect).map((o) => o.label) };
}
