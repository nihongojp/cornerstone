import { getDraftResources, getResources } from "@/lib/content/content";
import { getPreviewEditor } from "@/lib/session";
import Resources from "./Resources";
import ResourcesPreview from "./ResourcesPreview";

export default async function Page() {
  // The CMS preview path — see the note in the step player's page. Draft Mode
  // alone is not enough; the editor is re-checked against `cms_admins`.
  const editor = await getPreviewEditor();
  if (editor) {
    return (
      <ResourcesPreview
        initialGroups={await getDraftResources(editor)}
        serverURL={process.env.NEXT_PUBLIC_SERVER_URL || ""}
      />
    );
  }

  return <Resources data={await getResources()} />;
}
