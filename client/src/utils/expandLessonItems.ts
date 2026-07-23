import { NewLessonItem } from "../services/newLessons";
import {
  buildTermMediaRegistry,
  enrichItemWithTermMedia,
  resolveTermMedia,
  sameTerm,
  TermMediaRegistry,
} from "./termMedia";

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A term available as a multiple-choice image option — the phrase plus
// whatever image is already associated with it elsewhere in the lesson.
export type ChoiceCandidate = { phrase: string; imageUrl?: string };

function buildCheckpointPool(terms: string[], registry: TermMediaRegistry): ChoiceCandidate[] {
  return terms.map((phrase) => ({ phrase, imageUrl: resolveTermMedia(registry, phrase)?.imageUrl }));
}

// Adds `newTerms` to `existing`, skipping any that already match (by the same
// fuzzy comparison the media registry uses) so a term learned at one
// checkpoint isn't duplicated if it's re-listed at another.
function addTerms(existing: string[], newTerms: string[]): string[] {
  const merged = [...existing];
  for (const term of newTerms) {
    if (!merged.some((t) => sameTerm(t, term))) merged.push(term);
  }
  return merged;
}

// ── Generators ────────────────────────────────────────────────────────────────
// Each generator looks up the term's real media (already entered somewhere
// else in the lesson — a page, a matchingExercise dot, etc.) before falling
// back to a placeholder, so re-entering it in MongoDB Compass isn't needed.

function makeMatchAudio(
  phrase: string,
  number: number,
  registry: TermMediaRegistry,
  checkpointPool: ChoiceCandidate[]
): NewLessonItem {
  const media = resolveTermMedia(registry, phrase);
  return {
    type: "matchAudioExercise",
    number,
    phrase,
    audioUrl: media?.audioUrl ?? "PLACEHOLDER_AUDIO_URL",
    imageUrl: media?.imageUrl,
    // Other terms learned since the last checkpoint (or since the start of
    // the lesson, for the first checkpoint) — the distractor pool for the
    // multiple-choice image UI. See MatchAudioExercisePlaceholder.
    checkpointPool,
  } as unknown as NewLessonItem;
}

function makePronunciation(phrase: string, number: number, registry: TermMediaRegistry): NewLessonItem {
  const media = resolveTermMedia(registry, phrase);
  return {
    type: "pronunciationExercise",
    number,
    phrase,
    audioUrl: media?.audioUrl ?? "PLACEHOLDER_AUDIO_URL",
  } as unknown as NewLessonItem;
}

function makeDragDrop(
  phrase: string,
  number: number,
  registry: TermMediaRegistry,
  checkpointPool: ChoiceCandidate[]
): NewLessonItem {
  const media = resolveTermMedia(registry, phrase);
  return {
    type: "dragAndDropExercise",
    _term: phrase,
    number,
    audioUrl: media?.audioUrl,
    imageUrl: media?.imageUrl,
    // Other terms learned so far — the distractor pool for the
    // image-to-romanized-reading drag choices. See DragDropPlaceholder.
    checkpointPool,
  } as unknown as NewLessonItem;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Expand each checkpoint into its full set of practice exercises.
 *
 * Rules:
 * - A `matchingExercise` ("match the dots") defines a checkpoint — its
 *   items[].phrase values are the terms newly introduced since the last
 *   checkpoint (or since the start of the lesson, for the first one).
 * - Immediately after each checkpoint, exactly one matchAudioExercise, one
 *   pronunciationExercise, and one dragAndDropExercise is generated per
 *   newly-introduced term — guaranteeing equal counts regardless of what (if
 *   anything) was hand-authored for that checkpoint in MongoDB, so no
 *   exercises go missing. The three types appear as separate back-to-back
 *   batches, always in this order: match-audio → pronunciation → drag & drop.
 * - Each batch is independently (re-)shuffled on every call, so term order
 *   differs batch to batch and from the introduction order.
 * - Any hand-authored matchAudioExercise/pronunciationExercise/
 *   dragAndDropExercise items already in the source are dropped once a
 *   checkpoint has been seen, since they're now always regenerated above;
 *   items of those types appearing before the first checkpoint (where there's
 *   no term list yet) are left untouched.
 * - Everything else — pages, info breaks, life-useful facts — passes through
 *   completely unchanged, in its original position.
 */
export function expandLessonItems(items: NewLessonItem[]): NewLessonItem[] {
  // Built once from the raw, un-expanded items so media entered anywhere in
  // the lesson (a page's video/audio, a hand-authored matching-exercise dot,
  // etc.) is available to every other item that references the same term —
  // regardless of which one appears first.
  const registry = buildTermMediaRegistry(items);

  const result: NewLessonItem[] = [];
  let currentTerms: string[] = [];
  // All terms introduced at this checkpoint or any earlier one — the
  // distractor pool for multiple-choice exercises, kept cumulative so older
  // terms (e.g. from checkpoint 1) can still appear as wrong answers even
  // after later checkpoints (e.g. checkpoint 2) have moved on.
  let cumulativeTerms: string[] = [];
  let currentPool: ChoiceCandidate[] = [];
  let seenCheckpoint = false;
  let i = 0;

  while (i < items.length) {
    const item = items[i];
    const type = item.type as string;

    // ── Checkpoint: capture terms, then generate its 3 practice batches ──────
    if (type === "matchingExercise") {
      const matchItems: Array<{ phrase?: string }> = (item as any).items ?? [];
      currentTerms = matchItems.map((m) => String(m.phrase ?? "")).filter(Boolean);
      cumulativeTerms = addTerms(cumulativeTerms, currentTerms);
      currentPool = buildCheckpointPool(cumulativeTerms, registry);
      seenCheckpoint = true;
      result.push(enrichItemWithTermMedia(item, registry));
      i++;

      const poolForThisCheckpoint = currentPool;
      shuffled(currentTerms).forEach((phrase, idx) => {
        result.push(makeMatchAudio(phrase, idx + 1, registry, poolForThisCheckpoint));
      });
      shuffled(currentTerms).forEach((phrase, idx) => {
        result.push(makePronunciation(phrase, idx + 1, registry));
      });
      shuffled(currentTerms).forEach((phrase, idx) => {
        result.push(makeDragDrop(phrase, idx + 1, registry, poolForThisCheckpoint));
      });
      continue;
    }

    // ── Already regenerated above — drop any hand-authored ones from the
    // source once a checkpoint has been seen, so they aren't duplicated.
    // Before the first checkpoint there's no term list yet, so leave these
    // untouched if they somehow appear that early.
    if (
      seenCheckpoint &&
      (type === "matchAudioExercise" || type === "pronunciationExercise" || type === "dragAndDropExercise")
    ) {
      i++;
      continue;
    }

    // ── Pass through, filling in any media already associated with this
    // item's term elsewhere in the lesson ────────────────────────────────────
    result.push(enrichItemWithTermMedia(item, registry));
    i++;
  }

  return result;
}
