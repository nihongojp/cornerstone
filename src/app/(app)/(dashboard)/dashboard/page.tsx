import Dashboard from "../../../../pages-client/Dashboard";
import { listLessons } from "../../../../lib/content/content";

export default async function Page() {
  const allLessons = await listLessons();
  return <Dashboard allLessons={allLessons} />;
}
