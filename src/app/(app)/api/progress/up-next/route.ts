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
 * The lookup spans both lesson formats and returns `href` with it. Progress
 * records a slug and nothing about which player it came from, so resuming a
 * step-through lesson used to fall through to the not-found card and link to
 * /lesson/<slug> — the flashcard player, which cannot render it (#20).
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
        version: "",
        prefecture: "",
        // The lesson is gone, so the best guess is the player its progress was
        // most likely recorded in. The card still resolves to a real page.
        href: `/lesson/${latest.lessonId}`,
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
      version: lesson.version,
      prefecture: lesson.prefecture,
      href: lesson.href,
      lastStep: latest.lastStep ?? 0,
      accuracyPct: latest.accuracyPct ?? 0,
      status: latest.status,
    },
  });
}

export const dynamic = "force-dynamic";
