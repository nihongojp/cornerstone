"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import { CONTENT_DEPTH } from "../../lib/content/depth";

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
 * `depth` is the shared `CONTENT_DEPTH` rather than a number written here, and
 * that is the whole point: this is a second read path, and every time the two
 * have diverged the symptom has been content rendering on the site and silently
 * vanishing in the panel, with no error in either place. Block media is an
 * `upload` relationship, so at depth 0 each one streams back as a bare id and
 * `mediaSrc` returns undefined; a `termRef` in a block's prose needs a second
 * hop for the term's audio. Both live in `lib/content/depth.ts` now, so raising
 * it moves both paths at once.
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
    depth: CONTENT_DEPTH,
  });

  const lesson = toNewLessonDoc(data, nextSlug);
  return <NewLessonPlayer slug={lesson.slug} lesson={lesson} />;
}
