"use server";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { userProgress } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import type { ProgressStatus } from "./types";

/*
 * Persist a learner's place in a lesson.
 *
 * userId always comes from the session, never the argument, so a caller
 * cannot write progress onto someone else's account. Completing increments
 * `completions` in the UPDATE via sql, so two tabs finishing at once cannot
 * both write the same number.
 *
 * A CMS editor previewing has no learner session; this returns without
 * writing, matching the old handler's 401 that the player already ignored.
 */
export async function upsertProgress(payload: {
  lessonId: string;
  status: ProgressStatus;
  lastStep: number;
  stepKey?: string;
  accuracyPct?: number;
}): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const lessonId = String(payload.lessonId || "").trim();
  if (!lessonId) return;

  const values = {
    userId: session.user.id,
    lessonId,
    status: payload.status === "completed" ? ("completed" as const) : ("in_progress" as const),
    lastStep: Number.isFinite(payload.lastStep) ? Math.max(0, Number(payload.lastStep)) : 0,
    stepKey: typeof payload.stepKey === "string" ? payload.stepKey : "",
    accuracyPct: Number.isFinite(payload.accuracyPct)
      ? Math.min(100, Math.max(0, Number(payload.accuracyPct)))
      : 0,
    updatedAt: new Date(),
  };

  const completed = values.status === "completed";

  await db
    .insert(userProgress)
    .values({ ...values, completions: completed ? 1 : 0 })
    .onConflictDoUpdate({
      target: [userProgress.userId, userProgress.lessonId],
      set: {
        status: values.status,
        lastStep: values.lastStep,
        stepKey: values.stepKey,
        accuracyPct: values.accuracyPct,
        updatedAt: values.updatedAt,
        ...(completed ? { completions: sql`${userProgress.completions} + 1` } : {}),
      },
    });
}
