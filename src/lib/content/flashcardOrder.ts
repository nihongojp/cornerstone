import type { Lesson } from "../../payload/payload-types";

type Step = NonNullable<Lesson["steps"]>[number];

/*
 * Flashcards are the study-it-all-again screens, so they belong together at the end
 * of a lesson, not spread through it between the exercises. Authors tend to add one
 * flashcard step per batch of terms as they write; this is what gathers them, so the
 * lesson reads in the order it is taught and then ends on one run of review cards.
 */

/** A step that shows a flashcard deck (a vocabulary block laid out as flashcards). */
export function isFlashcardStep(step: Step): boolean {
  return (step.components ?? []).some(
    (block) => block.blockType === "vocabList" && block.layout === "flashcards"
  );
}

/** Every other step first, then the flashcard steps — each group in its original order. */
export function flashcardsLast<T extends Step>(steps: readonly T[]): T[] {
  return [...steps.filter((step) => !isFlashcardStep(step)), ...steps.filter(isFlashcardStep)];
}
