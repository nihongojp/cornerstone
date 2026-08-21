import "server-only";
import { and, eq } from "drizzle-orm";

import { db } from "./db";
import { userProgress } from "./db/schema";
import { getSession } from "./session";

/*
 * The two values the exercise shuffle is seeded from, read on the server.
 *
 * They have to be resolved here rather than in the player because the seed must
 * produce the same order during SSR and during hydration. `progress-client.ts`
 * fetches the same row, but it does it after mount — seeding from that would
 * render one order, then re-render another, which is the exact mismatch the
 * seeded shuffle exists to remove.
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
