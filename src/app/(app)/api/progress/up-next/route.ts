import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../../lib/db";
import { userProgress } from "../../../../../lib/db/schema";
import { getSession } from "../../../../../lib/session";
import { getLessonRoute } from "../../../../../lib/content/content";

/*
 * Replaces GET /api/progress/up-next.
 *
 * The old controller joined UserProgress to the Lesson collection inside Mongo.
 * Progress lives in Postgres and lessons in Payload, so the join happens here:
 * newest in-progress row, then look the lesson up by slug. The fallback shape
 * for a missing lesson is preserved exactly — a lesson deleted out from under
 * someone's progress still yields a usable "Continue lesson" card.
 *
 * The lookup spans both lesson formats and returns `href` with it. Both
 * formats resolve to the same /lessons/<slug> route now, so there's no
 * wrong-player fallback left to get wrong (there used to be — #20).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [latest] = await db
    .select()
    .from(userProgress)
    .where(
      and(
        eq(userProgress.userId, session.user.id),
        eq(userProgress.status, "in_progress")
      )
    )
    .orderBy(desc(userProgress.updatedAt))
    .limit(1);

  if (!latest) {
    return NextResponse.json({ upNext: null });
  }

  const lesson = await getLessonRoute(latest.lessonId);

  if (!lesson) {
    return NextResponse.json({
      upNext: {
        lessonId: latest.lessonId,
        slug: latest.lessonId,
        title: "Continue lesson",
        // The lesson row is gone, so there is no level/part to report.
        level: null,
        part: null,
        prefecture: "",
        // The lesson is gone; this is just a best-guess link so the card
        // still resolves to a real page rather than a dead one.
        href: `/lessons/${latest.lessonId}`,
        lastStep: latest.lastStep ?? 0,
        accuracyPct: latest.accuracyPct ?? 0,
        status: latest.status,
      },
    });
  }

  return NextResponse.json({
    upNext: {
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
    },
  });
}

export const dynamic = "force-dynamic";
