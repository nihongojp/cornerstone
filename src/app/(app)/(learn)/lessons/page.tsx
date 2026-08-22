import { listLessons, listNewLessons } from "@/lib/content/content";
import { getProgressBySlug } from "@/lib/progress-server";
import LessonsListPage from "@/features/learning/components/LessonsListPage";

export default async function Page() {
  // Fetched independently so a failure in one source still shows the other's
  // column, matching how the CRA page caught each request separately.
  const [newLessons, lessons, progressBySlug] = await Promise.all([
    listNewLessons().catch(() => []),
    listLessons().catch(() => []),
    /*
     * Caught for the same reason as the two above — one failing source must not
     * take the page down. Deliberately NOT `.catch(() => ({}))`: an empty map
     * renders every card as "not started", which a learner reads as *lost
     * progress* rather than *unavailable*. `null` keeps the two distinguishable.
     */
    getProgressBySlug().catch((error) => {
      console.error("[lessons] progress lookup failed", error);
      return null;
    }),
  ]);

  return (
    <LessonsListPage
      newLessons={newLessons}
      lessons={lessons}
      progressBySlug={progressBySlug}
    />
  );
}
