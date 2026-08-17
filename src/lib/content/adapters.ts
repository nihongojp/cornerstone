import type { Lesson, Resource } from "../../payload/payload-types";
import { mediaSrc } from "./media";
import type {
  LessonDoc,
  LessonExercise,
  LessonListItem,
  NewLessonDoc,
  NewLessonItem,
  NewLessonListItem,
  ResourceGroup,
} from "../types/lessons";

/*
 * Payload document → the exact TS shapes the lesson players already consume.
 *
 * This is the seam that keeps the pivot invisible to the UI: the storage model
 * is Course > Lesson > Exercise > Component, and everything below flattens it
 * back to the flat contract in `lib/types/lessons.ts`. While the authoring
 * convention holds — one component per exercise — the flattening is
 * item-for-item, so step counts and `stepKey` derivation are unchanged.
 *
 * Two renamings survive from the old data and are undone here rather than in
 * storage: the grammar player calls the display name `lesson` where the
 * collection calls it `title`, and `_id` is the Mongo id the content was
 * imported from (`sourceId`), falling back to Payload's own id so a
 * hand-authored lesson still has one.
 *
 * Fields Payload models as `T | null | undefined` are normalised to
 * `T | undefined`: the players check for absence, and a literal null reaching
 * something like `imageUrl` would render as a broken asset.
 *
 * Media is the one place the flattening now loses something. Storage holds an
 * `upload` relationship to a `media` document — alt text, dimensions, resized
 * variants — and the contract holds a URL string, so `mediaSrc` throws the rest
 * away. That is the deal for this phase: the players stay untouched while the
 * storage model changes underneath them. The alt text starts being used when
 * the blocks render directly and this file goes away.
 *
 * This flattening is also why `depth` matters. An unpopulated relationship
 * arrives as a bare id, `mediaSrc` returns undefined for it, and the lesson
 * renders with no images and no error. `content.ts` sets the depth for the
 * public path; the Live Preview wrappers set their own.
 *
 * Pure functions, and deliberately not marked `server-only` — they touch no
 * database, no environment and no secrets, which keeps them checkable outside
 * a Next request. `content.ts` and `payload.ts`, which do the reading, carry
 * the guard.
 */

type Block = NonNullable<Lesson["exercises"]>[number]["components"][number];

/** Payload writes absent optional fields as null; the contract says undefined. */
function opt<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

function optText(value: string | null | undefined): string | undefined {
  const v = opt(value);
  return v !== undefined && v.trim() !== "" ? v : undefined;
}

function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Every component of every exercise, in play order. */
function components(lesson: Lesson): Block[] {
  return list(lesson.exercises).flatMap((exercise) => list(exercise.components));
}

function identity(lesson: Lesson): { _id: string; slug: string } {
  return { _id: optText(lesson.sourceId) ?? String(lesson.id), slug: lesson.slug };
}

// ── The step-through (grammar) player ────────────────────────────────────────
/*
 * Component → one `items[]` entry. The four `*Page` blocks fold back into the
 * single `page` type they were split out of (#18): the player discriminates on
 * the fields present, exactly as it did when the source data was one shape.
 *
 * `termMediaSeed` maps back to a `dragAndDropExercise` carrying only media,
 * which is what it was before the split — but note the expansion that used to
 * consume those seeds now happens at import (#27), so in imported content they
 * are inert leftovers rather than input to anything.
 */
function blockToItem(block: Block): NewLessonItem {
  switch (block.blockType) {
    case "videoPage":
      return {
        type: "page",
        title: block.title,
        videoUrl: mediaSrc(block.video),
        videoForm: opt(block.videoForm),
        audioUrl: mediaSrc(block.audio),
        description: optText(block.description),
        content: optText(block.content),
      };
    case "termsPage":
      return {
        type: "page",
        title: block.title,
        format: optText(block.format),
        terms: list(block.terms).map((term) => ({
          term: term.term,
          imageUrl: mediaSrc(term.image),
          audioUrl: mediaSrc(term.audio),
        })),
        description: optText(block.description),
        content: optText(block.content),
      };
    case "grammarPage":
      return {
        type: "page",
        title: block.title,
        grammarPoints: list(block.grammarPoints).map((point) => ({
          pattern: point.pattern,
          examples: opt(point.examples),
        })),
        description: optText(block.description),
        content: optText(block.content),
      };
    case "contentPage":
      return {
        type: "page",
        title: block.title,
        description: optText(block.description),
        content: optText(block.content),
      };
    case "matchingExercise":
      return {
        type: "matchingExercise",
        instructions: block.instructions,
        items: list(block.items).map((item) => ({
          phrase: item.phrase,
          englishTranslation: optText(item.englishTranslation),
          audioUrl: mediaSrc(item.audio),
          imageUrl: mediaSrc(item.image),
        })),
        rows: opt(block.rows),
        dragDropOptions: opt(block.dragDropOptions),
        description: optText(block.description),
      };
    case "dragAndDropPuzzle":
      return {
        type: "dragAndDropExercise",
        // `_term` is the source spelling; Payload reserves leading underscores.
        _term: block.term,
        correctSequence: block.correctSequence,
        options: block.options,
        audioUrl: mediaSrc(block.audio),
        imageUrl: mediaSrc(block.image),
      };
    case "termMediaSeed":
      return {
        type: "dragAndDropExercise",
        _term: block.term,
        audioUrl: mediaSrc(block.audio),
        imageUrl: mediaSrc(block.image),
      };
    case "matchAudioExercise":
      return {
        type: "matchAudioExercise",
        phrase: block.phrase,
        audioUrl: mediaSrc(block.audio),
        imageUrl: mediaSrc(block.image),
      };
    case "pronunciationExercise":
      return {
        type: "pronunciationExercise",
        phrase: block.phrase,
        transcript: optText(block.transcript),
        videoUrl: mediaSrc(block.video),
        audioUrl: mediaSrc(block.audio),
      };
    case "infoBreak":
      return { type: "infoBreak", content: block.content };
    case "lifeUsefulFact":
      return { type: "lifeUsefulFact", content: block.content };
    default:
      // `legacyJson` (unmigrated content) and any block from the flashcard
      // family authored into a step lesson by mistake. Neither renders, so it
      // is dropped rather than handed to the player as an unknown step — the
      // admin flags these; the learner should not see a blank screen.
      return { type: "" };
  }
}

// ── The flashcard (legacy) player ────────────────────────────────────────────

function blockToLegacyExercise(block: Block): LessonExercise | null {
  switch (block.blockType) {
    case "connectTheDots":
      return {
        type: "connectTheDots",
        exerciseId: block.exerciseId,
        items: block.items,
        correctAnswers: block.correctAnswers,
        prompt: optText(block.prompt),
      };
    case "matchAudioLetter":
      return {
        type: "matchAudioLetter",
        exerciseId: block.exerciseId,
        items: block.items,
        correctAnswers: block.correctAnswers,
        audioUrl: mediaSrc(block.audio),
        prompt: optText(block.prompt),
      };
    case "vocabularyDragDrop":
      return {
        type: "vocabulary_drag_drop",
        exerciseId: block.exerciseId,
        characterBank: block.characterBank,
        correctAnswer: block.correctAnswer,
        prompt: optText(block.prompt),
        audioUrl: mediaSrc(block.audio),
        imageUrl: mediaSrc(block.image),
        bonus: block.bonus === true ? true : undefined,
      };
    case "factBreak":
      return {
        type: "factBreak",
        exerciseId: block.exerciseId,
        title: optText(block.title),
        content: optText(block.content),
        prompt: optText(block.prompt),
      };
    default:
      // Flashcard decks are hoisted separately, below; anything else is either
      // unmigrated content or a step-family block in the wrong lesson.
      return null;
  }
}

/*
 * The deck is a component in storage and two parallel arrays in the contract.
 * Import guarantees one deck, first, but an author can add a second — so the
 * decks are concatenated in play order rather than only the first being read,
 * which would silently drop cards.
 */
function flashcards(blocks: Block[]): { cards: string[]; audio: string[] } {
  const cards: string[] = [];
  const audio: string[] = [];

  for (const block of blocks) {
    if (block.blockType !== "flashcardDeck") continue;
    for (const card of list(block.cards)) {
      cards.push(card.card);
      // Positional, because the contract's two arrays are index-coupled: a card
      // with no audio still has to occupy its slot.
      audio.push(mediaSrc(card.audio) ?? "");
    }
  }

  // The old data omitted the audio array entirely when nothing was recorded,
  // and the player treats "" as absent — so an all-empty array is dropped
  // rather than handed over as a list of blanks.
  return { cards, audio: audio.some((url) => url !== "") ? audio : [] };
}

// ── Public adapters ──────────────────────────────────────────────────────────

export function toLessonListItem(lesson: Lesson): LessonListItem {
  return {
    ...identity(lesson),
    title: lesson.title,
    version: optText(lesson.version) ?? "",
    cardTitle: optText(lesson.cardTitle),
    flashcards: flashcards(components(lesson)).cards,
    prefecture: optText(lesson.prefecture) ?? "",
    // `isActive` is Payload's publish status now; only published docs are read.
    isActive: true,
  };
}

export function toLessonDoc(lesson: Lesson): LessonDoc {
  const blocks = components(lesson);
  const deck = flashcards(blocks);
  const achievement = lesson.achievement;
  const exercises = blocks
    .map(blockToLegacyExercise)
    .filter((exercise): exercise is LessonExercise => exercise !== null);

  return {
    ...toLessonListItem(lesson),
    flashcards: deck.cards,
    flashcardsAudio: deck.audio,
    funFact: optText(lesson.funFact),
    notes: optText(lesson.notes),
    exercises,
    achievement:
      achievement && optText(achievement.title)
        ? { title: achievement.title as string, xp: achievement.xp ?? 0 }
        : undefined,
    tags: list(lesson.tags),
  };
}

export function toNewLessonListItem(lesson: Lesson): NewLessonListItem {
  return {
    ...identity(lesson),
    // Storage calls it `title`; the grammar player has always called it `lesson`.
    lesson: lesson.title,
    cardTitle: optText(lesson.cardTitle),
    isActive: true,
    tags: list(lesson.tags),
  };
}

/**
 * `nextSlug` is no longer stored — the caller resolves the next lesson from
 * course order and passes its slug in (#18, #27).
 */
export function toNewLessonDoc(lesson: Lesson, nextSlug?: string): NewLessonDoc {
  return {
    ...toNewLessonListItem(lesson),
    items: components(lesson)
      .map(blockToItem)
      .filter((item) => item.type !== ""),
    nextSlug,
  };
}

export function toResourceGroup(resource: Resource): ResourceGroup {
  return {
    id: optText(resource.sourceId) ?? String(resource.id),
    category: resource.category,
    items: list(resource.items).map((item) => ({
      id: item.itemId,
      title: item.title,
      url: optText(item.url),
      description: optText(item.description),
    })),
  };
}
