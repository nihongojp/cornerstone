import { listLessons, listNewLessons } from "@/lib/content/content";
import LessonsListPage from "@/pages-client/LessonsListPage";

export default async function Page() {
  // Fetched independently so a failure in one source still shows the other's
  // column, matching how the CRA page caught each request separately.
  const [newLessons, lessons] = await Promise.all([
    listNewLessons().catch(() => []),
    listLessons().catch(() => []),
  ]);

  return <LessonsListPage newLessons={newLessons} lessons={lessons} />;
}
