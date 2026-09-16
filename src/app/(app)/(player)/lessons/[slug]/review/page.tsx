import { redirect } from "next/navigation";

import {
  getDraftLesson,
  getDraftNeighborLessonReviewHref,
  getLessonBySlug,
  getNeighborLessonReviewHref,
} from "@/lib/content/content";
import { getPreviewEditor } from "@/lib/session";
import { collectLessonTerms } from "@/lib/content/lessonTerms";
import TermReviewPage from "@/features/learning/components/TermReviewPage";

/*
 * Every term a lesson taught, on one page — a study aid rather than a graded
 * screen, so it reads the lesson the same way the player does rather than
 * needing its own progress-aware plumbing.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /*
   * The same preview branch the lesson route has. Without it an editor who
   * reached the review link from Live Preview on an unpublished lesson was
   * bounced to /dashboard — the one page that cannot show them what they are
   * writing. Draft access is still decided by `getPreviewEditor`, which only
   * answers for a request that came through /api/preview as a `cms_admins`
   * user; everything else reads published content.
   */
  const editor = await getPreviewEditor();
  const lesson = editor ? await getDraftLesson(slug, editor) : await getLessonBySlug(slug);
  if (!lesson) redirect("/dashboard");

  const terms = collectLessonTerms(lesson);
  const [prevHref, nextHref] = await Promise.all(
    editor
      ? [
          getDraftNeighborLessonReviewHref(lesson, editor, "prev"),
          getDraftNeighborLessonReviewHref(lesson, editor, "next"),
        ]
      : [
          getNeighborLessonReviewHref(lesson, "prev"),
          getNeighborLessonReviewHref(lesson, "next"),
        ]
  );

  return <TermReviewPage lesson={lesson} terms={terms} prevHref={prevHref} nextHref={nextHref} />;
}
