import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../lib/db";
import { userProgress } from "../../../../../lib/db/schema";
import { getSession } from "../../../../../lib/session";

// Replaces GET /api/progress/:lessonId. Returns { progress: doc | null } —
// the client treats null as "start from the top".
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  // `userProgress.lessonId` is a Postgres column name, not a database id —
  // it holds a lesson slug. Left as-is: renaming the column is a separate,
  // riskier schema change than renaming this route's param.
  const [row] = await db
    .select()
    .from(userProgress)
    .where(
      and(
        eq(userProgress.userId, session.user.id),
        eq(userProgress.lessonId, decodeURIComponent(slug))
      )
    )
    .limit(1);

  return NextResponse.json({ progress: row ?? null });
}

export const dynamic = "force-dynamic";
