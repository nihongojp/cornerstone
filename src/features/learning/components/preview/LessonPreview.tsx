"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import { CONTENT_DEPTH } from "@/lib/content/depth";
import { previewOrigin } from "@/lib/content/previewOrigin";

import LessonRunner from "../LessonRunner";
import type { Lesson } from "@/payload/payload-types";

/*
 * The Live Preview seam for lessons — both formats, one wrapper.
 *
 * The server hands down the raw Payload document; `useLivePreview` subscribes to
 * the admin's `postMessage` stream, merges the editor's unsaved form state into
 * it, and gives back another raw document. That goes straight to the runner.
 *
 * Until Phase 4b there were two of these — one per player — and each re-ran an
 * adapter on the client to avoid preview growing its own copy of the
 * document-to-player mapping. There is no mapping now, so the wrapper is the
 * subscription and nothing else, and the public path hands the runner the same
 * shape this does.
 *
 * `depth` is the shared `CONTENT_DEPTH` rather than a number written here, and
 * that is the point: this is a second read path, and every time the two have
 * diverged the symptom has been content rendering on the site and silently
 * vanishing in the panel, with no error in either place. Block media is an
 * `upload` relationship, so at depth 0 each one streams back as a bare id and
 * resolves to nothing; a term referenced in a block's prose needs a second hop
 * for its audio.
 */
export default function LessonPreview({
  initialLesson,
  nextHref,
  serverURL,
}: {
  initialLesson: Lesson;
  /*
   * Resolved once on the server and then held. The next lesson comes from a
   * second query against course order, and the hook only ever streams the
   * document the editor has open — there is nothing on the client to re-resolve
   * it from. It goes stale if they reorder the course mid-preview, which a save
   * and a reload fixes; the alternative is a fetch per keystroke.
   */
  nextHref?: string;
  /** The exact origin /admin is served from — the hook checks it against the
   * message origin, so a mismatch silently drops every update. Read on the
   * server and passed down, so there is one place to look when it is wrong. */
  serverURL: string;
}) {
  const { data } = useLivePreview<Lesson>({
    initialData: initialLesson,
    serverURL: previewOrigin(serverURL),
    depth: CONTENT_DEPTH,
  });

  /*
   * No `userId` or `attempt`: an editor previewing has no learner session, and
   * seeding from one would make the preview order depend on who is signed in to
   * the CMS. Everyone previewing sees the same order, which is the one a
   * signed-out learner gets.
   */
  return <LessonRunner lesson={data} nextHref={nextHref} />;
}
