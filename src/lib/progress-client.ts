"use client";

/*
 * Same exported surface as the old client/src/services/progress.ts, so the
 * lesson players port without touching their save/resume code. The transport
 * changes from an axios instance carrying a bearer token to a same-origin
 * fetch — the session cookie rides along automatically.
 */

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
  /** Where to resume — the two lesson formats play on different paths. */
  href: string;
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
  const res = await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to save progress (${res.status})`);
  return res.json();
}

/**
 * Fetch the current user's saved progress for one specific lesson (by
 * slug). Returns null if they haven't started it, or if unauthenticated /
 * the request fails — callers should treat that as "start from the top".
 */
export async function getProgress(lessonId: string): Promise<ProgressDoc | null> {
  try {
    const res = await fetch(`/api/progress/${encodeURIComponent(lessonId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { progress: ProgressDoc | null };
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
  // Still a no-op, as in the CRA app. The Attempt/ReviewItem collections were
  // dropped in the migration (no reader, no writer, and their stored rows were
  // keyed to an obsolete lesson-id scheme). Kept so player code is unchanged.
  return;
}

export async function getUpNextLesson(): Promise<UpNextLesson | null> {
  const res = await fetch("/api/progress/up-next");
  if (!res.ok) return null;
  const data = (await res.json()) as { upNext: UpNextLesson | null };
  return data?.upNext ?? null;
}
