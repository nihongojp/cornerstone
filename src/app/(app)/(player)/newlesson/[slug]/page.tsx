import { redirect } from "next/navigation";
import LessonRunner from "../../../../../pages-client/LessonRunner";
import LessonPreview from "../../../../../pages-client/preview/LessonPreview";
import {
  DRAFT_STEP,
  getDraftLesson,
  getDraftNextHref,
  getNewLessonBySlug,
  getNextLessonHref,
} from "../../../../../lib/content/content";
import { getShuffleIdentity } from "../../../../../lib/progress-server";
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
      <LessonPreview
        initialLesson={draft}
        nextHref={await getDraftNextHref(draft, editor)}
        serverURL={process.env.NEXT_PUBLIC_SERVER_URL || ""}
      />
    );
  }

  const lesson = await getNewLessonBySlug(slug);

  // Matches the CRA behaviour: a lesson that can't be fetched sends the user
  // back to the dashboard rather than rendering an empty player.
  if (!lesson) redirect("/dashboard");

  /*
   * The shuffle seed is resolved here, on the server, and travels as props.
   * Reading it in the browser instead would produce one order during SSR and
   * another after mount — the mismatch the seeded shuffle exists to remove.
   *
   * Uncached on purpose: it is per-learner, and `getShuffleIdentity` reads the
   * session. Putting it inside `unstable_cache` would serve one learner's seed
   * to the next.
   */
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
