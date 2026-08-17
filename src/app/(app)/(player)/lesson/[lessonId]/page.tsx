import { redirect } from "next/navigation";
import LessonRunner from "../../../../../pages-client/LessonRunner";
import LessonPreview from "../../../../../pages-client/preview/LessonPreview";
import {
  DRAFT_FLASHCARD,
  getDraftLesson,
  getDraftNextHref,
  getLessonBySlug,
  getNextLessonHref,
} from "../../../../../lib/content/content";
import { getShuffleIdentity } from "../../../../../lib/progress-server";
import { getPreviewEditor } from "../../../../../lib/session";

/*
 * The flashcard lesson route. Identical to the step route below the `format`
 * filter: both render `LessonRunner`, because after Phase 4b there is one
 * player. The two routes survive because the lists, the dashboard and every
 * existing link point at one or the other.
 */
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
        nextHref={await getDraftNextHref(draft, editor)}
        serverURL={process.env.NEXT_PUBLIC_SERVER_URL || ""}
      />
    );
  }

  // Accepts a slug or a legacy Mongo id — getLessonBySlug falls back to
  // sourceId, so old /lesson/<ObjectId> bookmarks keep working.
  const lesson = await getLessonBySlug(lessonId);

  if (!lesson) redirect("/dashboard");

  // The lesson's own slug, not the URL segment: this route also resolves a
  // legacy Mongo id, and progress is keyed on whatever the runner is handed.
  const { userId, attempt } = await getShuffleIdentity(lesson.slug);

  return (
    <LessonRunner
      lesson={lesson}
      nextHref={await getNextLessonHref(lesson)}
      userId={userId}
      attempt={attempt}
    />
  );
}
