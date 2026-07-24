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
    // Other terms learned so far — the distractor pool for the
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

function isPlaceholderUrlLike(url: unknown): boolean {
  return !url || typeof url !== "string" || url.toUpperCase().includes("PLACEHOLDER");
}

// A hand-authored dragAndDropExercise item found in the raw document, keyed
// by its own term — takes priority over auto-generation for that term.
type ManualDragDrop = { term: string; raw: Record<string, unknown> };

function findManualDragDropItems(items: NewLessonItem[]): ManualDragDrop[] {
  const found: ManualDragDrop[] = [];
  for (const it of items) {
    if ((it.type as string) !== "dragAndDropExercise") continue;
    const any = it as any;
    const term = String(any._term ?? any.phrase ?? any.term ?? "").trim();
    if (term) found.push({ term, raw: any });
  }
  return found;
}

// Builds the final dragAndDropExercise item for `phrase`: reuses a
// hand-authored one from MongoDB when present (Compass edits win), only
// falling back to real media / auto-generation for whatever it doesn't
// already specify — otherwise generates one from scratch as before.
function resolveDragDrop(
  phrase: string,
  number: number,
  registry: TermMediaRegistry,
  checkpointPool: ChoiceCandidate[],
  manualItems: ManualDragDrop[]
): NewLessonItem {
  const manual = manualItems.find((m) => sameTerm(m.term, phrase));
  if (!manual) return makeDragDrop(phrase, number, registry, checkpointPool);

  const media = resolveTermMedia(registry, phrase);
  return {
    ...manual.raw,
    type: "dragAndDropExercise",
    _term: phrase,
    number,
    audioUrl: !isPlaceholderUrlLike(manual.raw.audioUrl) ? manual.raw.audioUrl : media?.audioUrl,
    imageUrl: !isPlaceholderUrlLike(manual.raw.imageUrl) ? manual.raw.imageUrl : media?.imageUrl,
    checkpointPool,
    // Shuffled once here (not at render time) so the tile bank order is
    // fresh every lesson visit but stable for the whole attempt — matches
    // every other batch in this file.
    ...(Array.isArray(manual.raw.options) ? { options: shuffled(manual.raw.options) } : {}),
  } as unknown as NewLessonItem;
}

// Which checkpoint positions (1-indexed) are "full" — counted backward from
// the LAST checkpoint so the lesson always ends on a full one, rather than
// forward from the first. E.g. 4 total → {2, 4}; 3 total → {3}; 5 total →
// {3, 5}. Position 1 is never full on its own (a lesson with only 1
// checkpoint has none).
function computeFullCheckpointPositions(totalCheckpoints: number): Set<number> {
  const full = new Set<number>();
  for (let p = totalCheckpoints; p > 1; p -= 2) full.add(p);
  return full;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Expand each checkpoint into its practice exercises.
 *
 * Rules:
 * - A `matchingExercise` ("match the dots") defines a checkpoint — its
 *   items[].phrase values are the terms newly introduced since the last
 *   checkpoint (or since the start of the lesson, for the first one).
 * - Checkpoints alternate "light" and "full", counted backward from the
 *   last checkpoint in the lesson (see computeFullCheckpointPositions) —
 *   light checkpoints get only match-the-dots + a matchAudioExercise batch
 *   (one per term newly introduced there); full checkpoints additionally
 *   get a pronunciationExercise batch and a dragAndDropExercise batch,
 *   sized to cover every term introduced since the last full checkpoint
 *   (including any light-checkpoint terms in between) — so nothing goes
 *   untested, just deferred to the next full checkpoint.
 * - Each batch is independently (re-)shuffled on every call, so term order
 *   differs batch to batch and from the introduction order. Batches always
 *   appear in this order: match-audio → pronunciation → drag & drop.
 * - Any hand-authored matchAudioExercise/pronunciationExercise items already
 *   in the source are dropped once a checkpoint has been seen, since they're
 *   now always regenerated above; items of those types appearing before the
 *   first checkpoint (where there's no term list yet) are left untouched.
 * - dragAndDropExercise is different: a hand-authored one (keyed by its own
 *   `_term`) is a real, individually-editable MongoDB item — it's reused
 *   as-is (Compass edits win) for that term's exercise instead of being
 *   auto-generated. Any term that doesn't have one yet still gets one
 *   generated automatically, so coverage is still guaranteed either way.
 * - Everything else — pages, info breaks, life-useful facts — passes
 *   through completely unchanged, in its original position.
 */
export function expandLessonItems(items: NewLessonItem[]): NewLessonItem[] {
  // Built once from the raw, un-expanded items so media entered anywhere in
  // the lesson (a page's video/audio, a hand-authored matching-exercise dot,
  // etc.) is available to every other item that references the same term —
  // regardless of which one appears first.
  const registry = buildTermMediaRegistry(items);

  const totalCheckpoints = items.filter((it) => (it.type as string) === "matchingExercise").length;
  const fullPositions = computeFullCheckpointPositions(totalCheckpoints);
  const manualDragDropItems = findManualDragDropItems(items);

  const result: NewLessonItem[] = [];
  // Whole-lesson cumulative terms — the distractor pool for multiple-choice
  // exercises, so older terms can still appear as wrong answers even after
  // later checkpoints have moved on.
  let cumulativeTerms: string[] = [];
  // Terms introduced since the last FULL checkpoint (including any light
  // checkpoints in between) — resets once a full checkpoint covers them.
  let termsSinceLastFull: string[] = [];
  let currentPool: ChoiceCandidate[] = [];
  let checkpointCount = 0;
  let seenCheckpoint = false;
  let i = 0;

  while (i < items.length) {
    const item = items[i];
    const type = item.type as string;

    // ── Checkpoint: capture terms, then generate its practice batches ────────
    if (type === "matchingExercise") {
      const matchItems: Array<{ phrase?: string }> = (item as any).items ?? [];
      const currentTerms = matchItems.map((m) => String(m.phrase ?? "")).filter(Boolean);

      checkpointCount++;
      const isFull = fullPositions.has(checkpointCount);

      cumulativeTerms = addTerms(cumulativeTerms, currentTerms);
      termsSinceLastFull = addTerms(termsSinceLastFull, currentTerms);
      currentPool = buildCheckpointPool(cumulativeTerms, registry);
      seenCheckpoint = true;

      result.push(enrichItemWithTermMedia(item, registry));
      i++;

      const poolForThisCheckpoint = currentPool;
      shuffled(currentTerms).forEach((phrase, idx) => {
        result.push(makeMatchAudio(phrase, idx + 1, registry, poolForThisCheckpoint));
      });

      if (isFull) {
        const termsToCover = termsSinceLastFull;
        shuffled(termsToCover).forEach((phrase, idx) => {
          result.push(makePronunciation(phrase, idx + 1, registry));
        });

        // A manually-curated distractor pool (Compass field `dragDropOptions`
        // on this checkpoint's matchingExercise item) overrides the
        // auto-derived one for this checkpoint's drag-and-drop batch only —
        // the terms actually tested (termsToCover) are unaffected, only
        // which OTHER words can show up as wrong-answer tiles.
        const manualOptions: string[] = Array.isArray((item as any).dragDropOptions)
          ? (item as any).dragDropOptions.map((p: unknown) => String(p)).filter(Boolean)
          : [];
        const dragDropPool = manualOptions.length
          ? buildCheckpointPool(manualOptions, registry)
          : poolForThisCheckpoint;

        shuffled(termsToCover).forEach((phrase, idx) => {
          result.push(resolveDragDrop(phrase, idx + 1, registry, dragDropPool, manualDragDropItems));
        });
        termsSinceLastFull = []; // now covered by a full checkpoint
      }

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
