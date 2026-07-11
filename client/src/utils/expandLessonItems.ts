import { NewLessonItem } from "../services/newLessons";

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A placeholder exercise is one whose phrase field signals "fill me in
 * dynamically" rather than a real assigned phrase.
 * dragAndDropExercise items always count as placeholders because they never
 * carry a phrase field.
 */
function isPlaceholderItem(item: NewLessonItem): boolean {
  const type = item.type as string;
  if (type === "dragAndDropExercise") return true;
  const phrase = String((item as any).phrase ?? "").toLowerCase().trim();
  return (
    phrase === "" ||
    phrase.includes("random") ||
    phrase.includes("chosen") ||
    phrase.includes("placeholder")
  );
}

// ── Generators ────────────────────────────────────────────────────────────────

function makeMatchAudio(phrase: string, number: number): NewLessonItem {
  return {
    type: "matchAudioExercise",
    number,
    phrase,
    audioUrl: "PLACEHOLDER_AUDIO_URL",
  } as unknown as NewLessonItem;
}

function makePronunciation(phrase: string, number: number): NewLessonItem {
  return {
    type: "pronunciationExercise",
    number,
    phrase,
    audioUrl: "PLACEHOLDER_AUDIO_URL",
  } as unknown as NewLessonItem;
}

function makeDragDrop(templateItem: NewLessonItem, phrase: string, number: number): NewLessonItem {
  return {
    ...(templateItem as object),
    _term: phrase,
    number,
  } as unknown as NewLessonItem;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Expand placeholder exercise items into one-per-term repetitions.
 *
 * Rules:
 * - A `matchingExercise` defines the "current checkpoint" — its items[].phrase
 *   values become the term list for subsequent placeholder exercises.
 * - Consecutive placeholder items of the same type (matchAudioExercise,
 *   pronunciationExercise, dragAndDropExercise) are consumed as a group and
 *   replaced with exactly one generated item per checkpoint term, in a freshly
 *   shuffled order (randomised on every call).
 * - Non-placeholder exercises (e.g. Lesson 1's real-phrase matchAudio items)
 *   are passed through unchanged.
 * - Items before the first matchingExercise are always passed through.
 */
export function expandLessonItems(items: NewLessonItem[]): NewLessonItem[] {
  const result: NewLessonItem[] = [];
  let currentTerms: string[] = [];
  let i = 0;

  while (i < items.length) {
    const item = items[i];
    const type = item.type as string;

    // ── Checkpoint: capture + shuffle terms ──────────────────────────────────
    if (type === "matchingExercise") {
      const matchItems: Array<{ phrase?: string }> = (item as any).items ?? [];
      currentTerms = shuffled(matchItems.map((m) => String(m.phrase ?? "")));
      result.push(item);
      i++;
      continue;
    }

    // ── Expandable placeholder block ─────────────────────────────────────────
    const isExpandable =
      currentTerms.length > 0 &&
      (type === "matchAudioExercise" ||
        type === "pronunciationExercise" ||
        type === "dragAndDropExercise") &&
      isPlaceholderItem(item);

    if (isExpandable) {
      // Consume ALL consecutive placeholder items of this same type
      const templateItem = item;
      while (
        i < items.length &&
        (items[i] as any).type === type &&
        isPlaceholderItem(items[i])
      ) {
        i++;
      }

      // Emit one generated item per term
      currentTerms.forEach((phrase, idx) => {
        const num = idx + 1;
        if (type === "matchAudioExercise") {
          result.push(makeMatchAudio(phrase, num));
        } else if (type === "pronunciationExercise") {
          result.push(makePronunciation(phrase, num));
        } else {
          result.push(makeDragDrop(templateItem, phrase, num));
        }
      });
      continue;
    }

    // ── Pass through unchanged ───────────────────────────────────────────────
    result.push(item);
    i++;
  }

  return result;
}
