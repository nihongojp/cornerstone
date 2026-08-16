import { redirect } from "next/navigation";
import LessonPlayer from "../../../../../pages-client/LessonPlayer";
import { getLessonBySlug } from "../../../../../lib/content/content";

export default async function Page({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;

  // Accepts a slug or a legacy Mongo id — getLessonBySlug falls back to
  // SourceId, so old /lesson/<ObjectId> bookmarks keep working.
  const lesson = await getLessonBySlug(lessonId);

  if (!lesson) redirect("/dashboard");

  return <LessonPlayer lessonId={lessonId} lesson={lesson} />;
}
