"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import NewLessonPlayer from "../NewLessonPlayer";
import { toNewLessonDoc } from "../../lib/content/adapters";
import type { Lesson } from "../../payload/payload-types";

/*
 * The Live Preview seam for the step-through player.
 *
 * The server hands down the raw Payload document; `useLivePreview` subscribes
 * to the admin's `postMessage` stream and merges the editor's unsaved form
 * state into it, giving back another raw document. Running `toNewLessonDoc` on
 * that — the very adapter the server path runs — puts the real player in front
 * of unsaved content without a second copy of the mapping to keep in step.
 *
 * `depth: 0` matches the server read. Nothing here needs populating: the only
 * relationship on a lesson is `course`, used as a bare id, and every media
 * field on a block is a plain URL string rather than an upload relation.
 */
export default function NewLessonPreview({
  initialLesson,
  nextSlug,
  serverURL,
}: {
  initialLesson: Lesson;
  /*
   * Resolved once on the server and then held. The next lesson comes from a
   * second query against course order, and the hook only ever streams the
   * document the editor has open — there is nothing on the client to
   * re-resolve it from. It goes stale if they reorder the course mid-preview,
   * which a save and a reload fixes; the alternative is a fetch per keystroke.
   */
  nextSlug?: string;
  /** The exact origin /admin is served from — the hook checks it against the
   * message origin, so a mismatch silently drops every update. Read on the
   * server and passed down, so there is one place to look when it is wrong. */
  serverURL: string;
}) {
  const { data } = useLivePreview<Lesson>({
    initialData: initialLesson,
    serverURL,
    depth: 0,
  });

  const lesson = toNewLessonDoc(data, nextSlug);
  return <NewLessonPlayer slug={lesson.slug} lesson={lesson} />;
}
