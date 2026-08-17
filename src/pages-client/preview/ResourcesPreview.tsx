"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import Resources from "../Resources";
import { toResourceGroup } from "../../lib/content/adapters";
import type { Resource } from "../../payload/payload-types";

/*
 * The Live Preview seam for /resources.
 *
 * Unlike a lesson, a resource group has no page of its own — every group is a
 * section of one page. `useLivePreview` streams only the document the editor
 * has open, so the live copy is spliced back into the server-rendered list by
 * id and the rest are left as they were. That is the honest rendering: the
 * group being edited updates as it is typed, the others show what is currently
 * saved.
 */
export default function ResourcesPreview({
  initialGroups,
  serverURL,
}: {
  initialGroups: Resource[];
  serverURL: string;
}) {
  // The hook requires initial data, and an empty collection has none to give.
  // A placeholder keeps the hook unconditional (it cannot be called behind an
  // early return) while rendering nothing.
  const { data } = useLivePreview<Resource>({
    initialData: initialGroups[0] ?? ({} as Resource),
    serverURL,
    depth: 0,
  });

  const groups = initialGroups
    .map((group) => (data && group.id === data.id ? data : group))
    .map(toResourceGroup);

  return (
    <Resources
      data={groups.map((g) => ({
        id: g.id,
        category: g.category,
        items: g.items as never[],
      }))}
    />
  );
}
