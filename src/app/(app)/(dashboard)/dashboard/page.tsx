import { listLessons } from "@/lib/content/content";
import Dashboard from "@/pages-client/Dashboard";

export default async function Page() {
  const allLessons = await listLessons();
  return <Dashboard allLessons={allLessons} />;
}
