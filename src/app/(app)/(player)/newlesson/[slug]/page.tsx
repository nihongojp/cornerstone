import { redirect } from "next/navigation";
import NewLessonPlayer from "../../../../../pages-client/NewLessonPlayer";
import { getNewLessonBySlug } from "../../../../../lib/content/content";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = await getNewLessonBySlug(slug);

  // Matches the CRA behaviour: a lesson that can't be fetched sends the user
  // back to the dashboard rather than rendering an empty player.
  if (!lesson) redirect("/dashboard");

  // The lesson's own slug, not the URL segment: this route also resolves a
  // legacy Mongo id, and the player keys progress off whatever it is handed.
  // Passing the segment would write progress under an id that is not a slug —
  // which the user_progress FK rejects, and which resume would never find
  // again. The flashcard player already resolves its key the same way.
  return <NewLessonPlayer slug={lesson.slug} lesson={lesson} />;
}
