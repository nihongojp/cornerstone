import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../lib/db";
import { userProgress } from "../../../../../lib/db/schema";
import { getSession } from "../../../../../lib/session";

// Replaces GET /api/progress/:lessonId. Returns { progress: doc | null } —
// the client treats null as "start from the top".
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { lessonId } = await params;

  const [row] = await db
    .select()
    .from(userProgress)
    .where(
      and(
        eq(userProgress.userId, session.user.id),
        eq(userProgress.lessonId, decodeURIComponent(lessonId))
      )
    )
    .limit(1);

  return NextResponse.json({ progress: row ?? null });
}

export const dynamic = "force-dynamic";
