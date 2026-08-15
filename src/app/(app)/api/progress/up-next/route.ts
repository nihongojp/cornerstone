import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../../lib/db";
import { userProgress } from "../../../../../lib/db/schema";
import { getSession } from "../../../../../lib/session";
import { getLessonBySlug } from "../../../../../lib/airtable/content";

/*
 * Replaces GET /api/progress/up-next.
 *
 * The old controller joined UserProgress to the Lesson collection inside Mongo.
 * Progress now lives in Postgres and lessons in Airtable, so the join happens
 * here: newest in-progress row, then look the lesson up by slug. The fallback
 * shape for a missing lesson is preserved exactly — a lesson deleted out from
 * under someone's progress still yields a usable "Continue lesson" card.
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

  const lesson = await getLessonBySlug(latest.lessonId);

  if (!lesson) {
    return NextResponse.json({
      upNext: {
        lessonId: latest.lessonId,
        slug: latest.lessonId,
        title: "Continue lesson",
        version: "",
        prefecture: "",
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
      lastStep: latest.lastStep ?? 0,
      accuracyPct: latest.accuracyPct ?? 0,
      status: latest.status,
    },
  });
}

export const dynamic = "force-dynamic";
