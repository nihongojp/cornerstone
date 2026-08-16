import Resources from "../../../../pages-client/Resources";
import { getResources } from "../../../../lib/content/content";

export default async function Page() {
  const groups = await getResources();
  return (
    <Resources
      data={groups.map((g) => ({ id: g.id, category: g.category, items: g.items as never[] }))}
    />
  );
}
