import { listLessons } from "@/lib/content/content";
import { getUpNextLesson } from "@/lib/progress-server";
import Dashboard from "@/features/learning/components/Dashboard";

export default async function Page() {
  const [allLessons, upNext] = await Promise.all([listLessons(), getUpNextLesson()]);
  return <Dashboard allLessons={allLessons} upNext={upNext} />;
}
