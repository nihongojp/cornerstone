import { redirect } from "next/navigation";
import LessonRunner from "../../../../../pages-client/LessonRunner";
import LessonPreview from "../../../../../pages-client/preview/LessonPreview";
import {
  getDraftLesson,
  getDraftNextHref,
  getLessonBySlug,
  getNextLessonHref,
} from "../../../../../lib/content/content";
import { getShuffleIdentity } from "../../../../../lib/progress-server";
import { getPreviewEditor } from "../../../../../lib/session";

/*
 * The one lesson route, either format. Was two routes (/lesson/[lessonId],
 * /newlesson/[slug]) until Phase 4b made them render the same `LessonRunner`
 * — see the note on `lessonHref` in `lib/content/routes.ts`.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The CMS preview path — only a request that came through /api/preview
  // *and* still resolves to a `cms_admins` user gets here; everything else
  // reads published content.
  const editor = await getPreviewEditor();
  if (editor) {
    const draft = await getDraftLesson(slug, editor);
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
  // sourceId, so old bookmarks keep working.
  const lesson = await getLessonBySlug(slug);

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
