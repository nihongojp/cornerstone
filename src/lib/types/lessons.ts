/*
 * Copied verbatim from client/src/services/{lessons,newLessons}.ts.
 *
 * These are the shapes both lesson players already consume. The Airtable
 * adapters produce exactly these, so the player components port over without
 * any data-shape changes.
 */

export type LessonExercise =
  | {
      exerciseId: string;
      type: "connectTheDots";
      items: string[];
      correctAnswers: string[];
      prompt?: string;
    }
  | {
      exerciseId: string;
      type: "matchAudioLetter";
      items: string[];
      correctAnswers: string[];
      audioUrl?: string;
      prompt?: string;
    }
  | {
      exerciseId: string;
      type: "vocabulary_drag_drop";
      characterBank: string[];
      correctAnswer: string;
      prompt?: string;
      audioUrl?: string;
      imageUrl?: string;
      image?: string;
      /** V2+ bonus batch — hiragana tiles, no Japanese caption hint. */
      bonus?: boolean;
    }
  | {
      exerciseId: string;
      type: "factBreak";
      title?: string;
      content?: string;
      prompt?: string;
    };

export type LessonDoc = {
  _id: string;
  slug: string;
  title: string;
  version: string;
  cardTitle?: string; // editable heading shown on the Lessons list card

  flashcards: string[];
  /** Parallel to flashcards — per-card audio URLs when authored. */
  flashcardsAudio?: string[];
  funFact?: string;
  notes?: string;

  exercises?: LessonExercise[];
  achievement?: { title: string; xp: number };

  prefecture: string;
  isActive?: boolean;
  tags?: string[];
};

export type LessonListItem = Pick<
  LessonDoc,
  "_id" | "slug" | "title" | "version" | "cardTitle" | "flashcards" | "prefecture" | "isActive"
>;

// Loose item type — newlessons items are heterogeneous (page, pronunciationExercise,
// matchingExercise, matchAudioExercise, dragAndDropExercise, infoBreak, lifeUsefulFact).
// Typed as a discriminated-union-friendly base; callers can narrow by item.type.
//
// pronunciationExercise fields (optional except type/phrase):
//   phrase, transcript?, videoUrl?, audioUrl?
//   — audioUrl is dedicated reference audio (not the video track).
export type NewLessonItem = {
  type: string;
  number?: number;
  [key: string]: unknown;
};

// Shape returned by the list endpoint (no items[] — just metadata).
export type NewLessonListItem = {
  _id: string;
  lesson: string; // title string, e.g. "Lesson 1 V1"
  slug: string;
  cardTitle?: string; // editable heading shown on the Lessons list card
  isActive?: boolean;
  tags?: string[];
};

// Full document shape returned by the single-lesson endpoint.
export type NewLessonDoc = NewLessonListItem & {
  items: NewLessonItem[];
  // When set, finishing this lesson offers "Continue" straight into the
  // named lesson (by slug) instead of the normal exit back to the list.
  nextSlug?: string;
};

export type ResourceGroup = {
  id: string;
  category: string;
  items: unknown[];
};
