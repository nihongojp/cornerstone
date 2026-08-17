"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import LessonPlayer from "../LessonPlayer";
import { toLessonDoc } from "../../lib/content/adapters";
import type { Lesson } from "../../payload/payload-types";

/*
 * The Live Preview seam for the flashcard player. Same shape as
 * `NewLessonPreview` — see the note there for why the adapter runs on the
 * client and why `depth: 0` is enough.
 */
export default function LessonPreview({
  initialLesson,
  serverURL,
}: {
  initialLesson: Lesson;
  serverURL: string;
}) {
  const { data } = useLivePreview<Lesson>({
    initialData: initialLesson,
    serverURL,
    depth: 0,
  });

  const lesson = toLessonDoc(data);
  return <LessonPlayer lessonId={lesson.slug} lesson={lesson} />;
}
