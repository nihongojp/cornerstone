// src/services/lessons.ts
import api from "./api";

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
    };

export type LessonDoc = {
  _id: string;
  slug: string;
  title: string;
  version: string;
  cardTitle?: string; // editable heading shown on the Lessons list card

  flashcards: string[];
  /** Parallel to flashcards — per-card audio URLs when authored in Mongo. */
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

const BASE = "/api/lessons";

function normalizePrefecture(p?: string) {
  return (p || "").trim();
}

async function getWithFallback<T>(url: string) {
  try {
    return await api.get<T>(url);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404 && url.startsWith("/api/")) {
      const alt = url.replace(/^\/api/, "");
      console.warn("[Lessons] 404 on", url, "retrying", alt);
      return await api.get<T>(alt);
    }
    throw err;
  }
}

export async function listLessons(params?: { prefecture?: string; includeInactive?: boolean }) {
  const sp = new URLSearchParams();

  const prefecture = normalizePrefecture(params?.prefecture);
  if (prefecture) sp.set("prefecture", prefecture);

  if (params?.includeInactive) sp.set("includeInactive", "true");

  const url = sp.toString() ? `${BASE}?${sp.toString()}` : BASE;

  console.log("[Lessons] listLessons ->", url);

  const res = await getWithFallback<{ lessons: LessonListItem[] }>(url);

  const lessons = res.data?.lessons ?? [];
  console.log(
    "[Lessons] listLessons <-",
    { count: lessons.length, sample: lessons.slice(0, 5).map((l) => ({ slug: l.slug, title: l.title, pref: l.prefecture, active: l.isActive })) }
  );

  return lessons;
}

export async function getLesson(lessonIdOrSlug: string) {
  const id = String(lessonIdOrSlug || "").trim();
  const url = `${BASE}/${encodeURIComponent(id)}`;

  console.log("[Lessons] getLesson ->", url);

  const res = await getWithFallback<{ lesson: LessonDoc }>(url);

  console.log("[Lessons] getLesson <-", {
    slug: res.data?.lesson?.slug,
    title: res.data?.lesson?.title,
    pref: res.data?.lesson?.prefecture,
    exercises: (res.data?.lesson as any)?.exercises?.length ?? 0,
    flashcards: (res.data?.lesson as any)?.flashcards?.length ?? 0,
  });

  return res.data.lesson;
}