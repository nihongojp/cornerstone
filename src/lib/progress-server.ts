import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { ProgressDoc, UpNextLesson } from "@/features/learning/types";
import { getLessonRoute } from "./content/content";
import { db } from "./db";
import { userProgress } from "./db/schema";
import { getSession } from "./session";

/*
 * The two values the exercise shuffle is seeded from, read on the server.
 *
 * They have to be resolved here rather than in the player because the seed must
 * produce the same order during SSR and during hydration. Seeding from a
 * fetch after mount would render one order, then re-render another, which is
 * the exact mismatch the seeded shuffle exists to remove.
 */
export async function getShuffleIdentity(
  lessonSlug: string
): Promise<{ userId?: string; attempt: number }> {
  const session = await getSession();
  // A signed-out learner has no id and no completions. They get a stable shared
  // order, which is all the shuffle needs to be: the same on both sides.
  if (!session) return { attempt: 0 };

  const [row] = await db
    .select({ completions: userProgress.completions })
    .from(userProgress)
    .where(
      and(eq(userProgress.userId, session.user.id), eq(userProgress.lessonId, lessonSlug))
    )
    .limit(1);

  return { userId: session.user.id, attempt: row?.completions ?? 0 };
}

function toProgressDoc(row: {
  lessonId: string;
  status: "in_progress" | "completed";
  lastStep: number;
  stepKey: string;
  accuracyPct: number;
}): ProgressDoc {
  return {
    lessonId: row.lessonId,
    status: row.status,
    lastStep: row.lastStep,
    stepKey: row.stepKey || undefined,
    accuracyPct: row.accuracyPct,
  };
}

/** One lesson's saved progress, or null if they have not started it. */
export async function getProgress(lessonSlug: string): Promise<ProgressDoc | null> {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select()
    .from(userProgress)
    .where(
      and(eq(userProgress.userId, session.user.id), eq(userProgress.lessonId, lessonSlug)),
    )
    .limit(1);

  return row ? toProgressDoc(row) : null;
}

/** Every in-progress or completed slug for the signed-in learner. */
export async function getProgressBySlug(): Promise<Record<string, ProgressDoc["status"]>> {
  const session = await getSession();
  if (!session) return {};

  const rows = await db
    .select({ lessonId: userProgress.lessonId, status: userProgress.status })
    .from(userProgress)
    .where(eq(userProgress.userId, session.user.id));

  return Object.fromEntries(rows.map((row) => [row.lessonId, row.status]));
}

export async function getUpNextLesson(): Promise<UpNextLesson | null> {
  const session = await getSession();
  if (!session) return null;

  const [latest] = await db
    .select()
    .from(userProgress)
    .where(
      and(eq(userProgress.userId, session.user.id), eq(userProgress.status, "in_progress")),
    )
    .orderBy(desc(userProgress.updatedAt))
    .limit(1);

  if (!latest) return null;

  const lesson = await getLessonRoute(latest.lessonId);

  if (!lesson) {
    return {
      lessonId: latest.lessonId,
      slug: latest.lessonId,
      title: "Continue lesson",
      level: null,
      part: null,
      prefecture: "",
      href: `/lessons/${latest.lessonId}`,
      lastStep: latest.lastStep ?? 0,
      accuracyPct: latest.accuracyPct ?? 0,
      status: latest.status,
    };
  }

  return {
    lessonId: latest.lessonId,
    slug: lesson.slug,
    title: lesson.title,
    level: lesson.level,
    part: lesson.part,
    prefecture: lesson.prefecture,
    href: lesson.href,
    lastStep: latest.lastStep ?? 0,
    accuracyPct: latest.accuracyPct ?? 0,
    status: latest.status,
  };
}

