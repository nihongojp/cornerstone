import api from "./api";

// Loose item type — newlessons items are heterogeneous (page, pronunciationExercise,
// matchingExercise, matchAudioExercise, dragAndDropExercise, infoBreak, lifeUsefulFact).
// Typed as a discriminated-union-friendly base; callers can narrow by item.type.
export type NewLessonItem = {
  type: string;
  number?: number;
  [key: string]: unknown;
};

// Shape returned by the list endpoint (no items[] — just metadata).
// Mirrors LessonListItem from services/lessons.ts.
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
};

const BASE = "/api/newlessons";

/**
 * Fetch all active new lessons.
 * Returns an array to match listLessons() shape; works correctly when only one
 * document exists and will scale as more are added.
 */
export async function listNewLessons(): Promise<NewLessonListItem[]> {
  const res = await api.get<{ newLessons: NewLessonListItem[] }>(BASE);
  return res.data?.newLessons ?? [];
}

/**
 * Fetch a single new lesson by slug (full document including items[]).
 * Mirrors getLesson() from services/lessons.ts.
 */
export async function getNewLesson(slug: string): Promise<NewLessonDoc> {
  const res = await api.get<{ newLesson: NewLessonDoc }>(
    `${BASE}/${encodeURIComponent(slug)}`
  );
  return res.data.newLesson;
}
