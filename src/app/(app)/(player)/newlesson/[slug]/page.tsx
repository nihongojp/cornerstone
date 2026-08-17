import { redirect } from "next/navigation";
import NewLessonPlayer from "../../../../../pages-client/NewLessonPlayer";
import NewLessonPreview from "../../../../../pages-client/preview/NewLessonPreview";
import {
  DRAFT_STEP,
  getDraftLesson,
  getDraftNextSlug,
  getNewLessonBySlug,
} from "../../../../../lib/content/content";
import { getPreviewEditor } from "../../../../../lib/session";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /*
   * The CMS preview path. Draft Mode is only ever on for a request that came
   * through /api/preview, and `getPreviewEditor` re-checks that editor against
   * `cms_admins` rather than trusting the cookie. Anything short of a real
   * editor falls through to the published path below, unchanged.
   */
  const editor = await getPreviewEditor();
  if (editor) {
    const draft = await getDraftLesson(slug, DRAFT_STEP, editor);
    if (!draft) redirect("/dashboard");

    return (
      <NewLessonPreview
        initialLesson={draft}
        nextSlug={await getDraftNextSlug(draft, editor)}
        serverURL={process.env.NEXT_PUBLIC_SERVER_URL || ""}
      />
    );
  }

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
