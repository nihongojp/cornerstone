import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db";
import { userProgress } from "../../../lib/db/schema";
import { getSession } from "../../../lib/session";

/*
 * Replaces POST /api/progress from server/src/routes/progressRoutes.ts.
 *
 * The session check here is the real gate — the middleware only checks that a
 * cookie exists. userId always comes from the session, never the request body,
 * so a caller can't write progress onto someone else's account.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: {
    lessonId?: string;
    status?: "in_progress" | "completed";
    lastStep?: number;
    stepKey?: string;
    accuracyPct?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Expected a JSON body" }, { status: 400 });
  }

  const lessonId = String(body.lessonId || "").trim();
  if (!lessonId) {
    return NextResponse.json({ message: "lessonId is required" }, { status: 400 });
  }

  const values = {
    userId: session.user.id,
    lessonId,
    status: body.status === "completed" ? ("completed" as const) : ("in_progress" as const),
    lastStep: Number.isFinite(body.lastStep) ? Math.max(0, Number(body.lastStep)) : 0,
    stepKey: typeof body.stepKey === "string" ? body.stepKey : "",
    accuracyPct: Number.isFinite(body.accuracyPct)
      ? Math.min(100, Math.max(0, Number(body.accuracyPct)))
      : 0,
    updatedAt: new Date(),
  };

  // Mirrors the Mongo findOneAndUpdate({userId, lessonId}, …, {upsert:true}),
  // backed by the unique index on (user_id, lesson_id).
  const [row] = await db
    .insert(userProgress)
    .values(values)
    .onConflictDoUpdate({
      target: [userProgress.userId, userProgress.lessonId],
      set: {
        status: values.status,
        lastStep: values.lastStep,
        stepKey: values.stepKey,
        accuracyPct: values.accuracyPct,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  return NextResponse.json(row);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, session.user.id));

  return NextResponse.json({ progress: rows });
}

export const dynamic = "force-dynamic";
