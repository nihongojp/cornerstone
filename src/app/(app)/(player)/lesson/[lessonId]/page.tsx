import { redirect } from "next/navigation";
import LessonPlayer from "../../../../../pages-client/LessonPlayer";
import LessonPreview from "../../../../../pages-client/preview/LessonPreview";
import {
  DRAFT_FLASHCARD,
  getDraftLesson,
  getLessonBySlug,
} from "../../../../../lib/content/content";
import { getPreviewEditor } from "../../../../../lib/session";

export default async function Page({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;

  // The CMS preview path — see the note in the step player's page. Only a
  // request that came through /api/preview *and* still resolves to a
  // `cms_admins` user gets here; everything else reads published content.
  const editor = await getPreviewEditor();
  if (editor) {
    const draft = await getDraftLesson(lessonId, DRAFT_FLASHCARD, editor);
    if (!draft) redirect("/dashboard");

    return (
      <LessonPreview
        initialLesson={draft}
        serverURL={process.env.NEXT_PUBLIC_SERVER_URL || ""}
      />
    );
  }

  // Accepts a slug or a legacy Mongo id — getLessonBySlug falls back to
  // SourceId, so old /lesson/<ObjectId> bookmarks keep working.
  const lesson = await getLessonBySlug(lessonId);

  if (!lesson) redirect("/dashboard");

  return <LessonPlayer lessonId={lessonId} lesson={lesson} />;
}
