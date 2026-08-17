import type { CollectionBeforeDeleteHook } from "payload";
import { APIError } from "payload";

/*
 * Refuses to delete a lesson anyone has progress on, with a message an editor
 * can act on.
 *
 * The real guarantee is the ON DELETE RESTRICT foreign key from
 * `user_progress.lesson_id`, declared in
 * `payload/migrations/20260815_120000_user_progress_lesson_fk.ts` — it
 * holds even for a delete that never goes through the admin. Without this hook
 * that constraint still fires, but the editor sees a raw Postgres error naming
 * a table they have never heard of. This is the error message, not the rule.
 *
 * Unpublishing is the intended alternative: it takes the lesson off the site
 * while leaving the row the progress points at, so nobody's history breaks.
 */
export const guardLessonDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const lesson = await req.payload.findByID({
    collection: "lessons",
    id,
    depth: 0,
    overrideAccess: true,
  });

  if (!lesson?.slug) return;

  // Queried through drizzle rather than Payload: `user_progress` is the app's
  // own table in the `public` schema and Payload knows nothing about it.
  const { db } = await import("../../lib/db");
  const { userProgress } = await import("../../lib/db/schema");
  const { eq, count } = await import("drizzle-orm");

  const [row] = await db
    .select({ learners: count() })
    .from(userProgress)
    .where(eq(userProgress.lessonId, lesson.slug));

  const learners = row?.learners ?? 0;
  if (learners === 0) return;

  throw new APIError(
    `${learners} ${learners === 1 ? "learner has" : "learners have"} progress on "${lesson.title}". ` +
      "Deleting it would destroy that progress, so the database refuses. " +
      "Unpublish the lesson instead — it comes off the site and their history survives.",
    400,
    undefined,
    true
  );
};
