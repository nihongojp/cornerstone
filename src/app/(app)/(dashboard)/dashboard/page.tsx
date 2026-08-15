import Dashboard from "../../../../pages-client/Dashboard";
import { listLessons } from "../../../../lib/airtable/content";

export default async function Page() {
  const allLessons = await listLessons();
  return <Dashboard allLessons={allLessons} />;
}
