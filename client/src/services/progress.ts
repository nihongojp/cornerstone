// src/services/progress.ts
import { json } from "./api";

export type ProgressStatus = "in_progress" | "completed";

export type ProgressDoc = {
  _id?: string;
  userId?: string;
  lessonId: string;
  status: ProgressStatus;
  lastStep: number;
  stepKey?: string;
  accuracyPct?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type UpNextLesson = {
  lessonId: string;
  slug: string;
  title: string;
  version?: string;
  prefecture?: string;
  lastStep: number;
  accuracyPct?: number;
  status: ProgressStatus;
};

export async function upsertProgress(payload: {
  lessonId: string;
  status: ProgressStatus;
  lastStep: number;
  stepKey?: string;
  accuracyPct?: number;
}): Promise<ProgressDoc> {
  return json<ProgressDoc>("/api/progress", {
    method: "POST",
    data: payload,
  });
}

/**
 * Fetch the current user's saved progress for one specific lesson (by
 * slug). Returns null if they haven't started it, or if unauthenticated /
 * the request fails — callers should treat that as "start from the top".
 */
export async function getProgress(lessonId: string): Promise<ProgressDoc | null> {
  try {
    const data = await json<{ progress: ProgressDoc | null }>(
      `/api/progress/${encodeURIComponent(lessonId)}`
    );
    return data?.progress ?? null;
  } catch {
    return null;
  }
}

export async function submitAttempt(payload: {
  lessonId: string;
  stepIndex: number;
  result: "correct" | "incorrect";
  detail?: any;
}): Promise<void> {
  // Wire up to backend when ready
  return;
}

export async function getUpNextLesson(): Promise<UpNextLesson | null> {
  const data = await json<{ upNext: UpNextLesson | null }>("/api/progress/up-next");
  return data?.upNext ?? null;
}