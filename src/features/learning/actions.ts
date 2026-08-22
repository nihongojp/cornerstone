"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { userProgress } from "@/lib/db/schema";
import { getPreviewEditor, getSession } from "@/lib/session";
import type { ProgressStatus, SaveResult } from "./types";

/*
 * Persist a learner's place in a lesson.
 *
 * userId always comes from the session, never the argument, so a caller
 * cannot write progress onto someone else's account. Completing increments
 * `completions` in the UPDATE via sql, so two tabs finishing at once cannot
 * both write the same number.
 *
 * Returns a result rather than void, and the reason that matters is not
 * politeness: a CMS editor previewing a draft has no learner session and
 * writing nothing is correct, while a learner whose cookie expired mid-lesson
 * also writes nothing and has just lost their progress. Those were the same
 * silent `return` before, so the second was invisible to the learner, to the
 * player, and to the server log at once. They are now distinguishable, and the
 * player refuses to navigate away from an unsaved completion.
 */
export async function upsertProgress(payload: {
  lessonId: string;
  status: ProgressStatus;
  lastStep: number;
  stepKey?: string;
  accuracyPct?: number;
}): Promise<SaveResult> {
  const session = await getSession();
  if (!session) {
    // The editor case: nothing to save, and nothing wrong.
    if (await getPreviewEditor()) return { ok: true, saved: false };

    console.error("[progress] save dropped — no learner session", {
      lessonId: payload.lessonId,
    });
    return {
      ok: false,
      reason: "signed-out",
      message: "You've been signed out, so this wasn't saved. Sign in again to keep your place.",
    };
  }

  const lessonId = String(payload.lessonId || "").trim();
  if (!lessonId) {
    // A programming error, not a user condition — the callers all guard on
    // slug. Loud, because the old route answered 400 and this replaced it.
    console.error("[progress] save rejected — empty lessonId", { payload });
    return { ok: false, reason: "failed", message: "That didn't save. Try again." };
  }

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

  try {
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
  } catch (error) {
    // Server-side, because a client `console.error` lands in a browser the
    // learner has usually just navigated away from.
    console.error("[progress] save failed", { lessonId, status: values.status, error });
    return { ok: false, reason: "failed", message: "That didn't save. Try again." };
  }

  /*
   * The reads moved into server components, so the write has to say what it
   * invalidated. Both pages are dynamic today (they call getSession, which
   * reads headers) and Next 16 defaults `staleTimes.dynamic` to 0 — so this is
   * belt and braces for forward navigation, but it is what makes back/forward
   * out of the Router Cache correct, and it stops a later `staleTimes` setting
   * from silently serving pre-write progress.
   */
  revalidatePath("/lessons");
  revalidatePath("/dashboard");
  revalidatePath(`/lessons/${lessonId}`);

  return { ok: true, saved: true };
}
