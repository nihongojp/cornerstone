"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import { CONTENT_DEPTH } from "@/lib/content/depth";
import { previewOrigin } from "@/lib/content/previewOrigin";

import Resources from "./Resources";
import type { Resource } from "@/payload/payload-types";

/*
 * The Live Preview seam for /resources.
 *
 * Unlike a lesson, a resource group has no page of its own — every group is a
 * section of one page. `useLivePreview` streams only the document the editor has
 * open, so the live copy is spliced back into the server-rendered list by id and
 * the rest are left as they were. That is the honest rendering: the group being
 * edited updates as it is typed, the others show what is currently saved.
 *
 * Phase 4b removed the adapter call that used to sit at the end of this. The
 * page renders `Resource` documents directly now, which is the shape the hook
 * streams — so the splice is the whole wrapper.
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
    serverURL: previewOrigin(serverURL),
    // Matches the server read. A link's description is rich text, so a term
    // reference or an image in one would otherwise render on /resources and
    // vanish in the panel.
    depth: CONTENT_DEPTH,
  });

  return (
    <Resources
      data={initialGroups.map((group) => (data && group.id === data.id ? data : group))}
    />
  );
}
