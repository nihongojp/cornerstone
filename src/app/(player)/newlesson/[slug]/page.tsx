import { redirect } from "next/navigation";
import NewLessonPlayer from "../../../../pages-client/NewLessonPlayer";
import { getNewLessonBySlug } from "../../../../lib/airtable/content";

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

  return <NewLessonPlayer slug={slug} lesson={lesson} />;
}
