import { listLessons, listNewLessons } from "@/lib/content/content";
import { getProgressBySlug } from "@/lib/progress-server";
import LessonsListPage from "@/features/learning/components/LessonsListPage";

export default async function Page() {
  // Fetched independently so a failure in one source still shows the other's
  // column, matching how the CRA page caught each request separately.
  const [newLessons, lessons, progressBySlug] = await Promise.all([
    listNewLessons().catch(() => []),
    listLessons().catch(() => []),
    getProgressBySlug(),
  ]);

  return (
    <LessonsListPage
      newLessons={newLessons}
      lessons={lessons}
      progressBySlug={progressBySlug}
    />
  );
}
