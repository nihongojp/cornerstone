export type ProgressStatus = "in_progress" | "completed";

/**
 * What a progress write actually did.
 *
 * `void` is not enough here: a CMS editor previewing a draft has no learner
 * session and legitimately writes nothing, while a learner whose session
 * expired mid-lesson also writes nothing — and only the second is data loss.
 * The caller has to be able to tell those apart, so they are separate results
 * rather than a shared silent return.
 */
export type SaveResult =
  | { ok: true; saved: boolean }
  | { ok: false; reason: "signed-out" | "failed"; message: string };

export type ProgressDoc = {
  lessonId: string;
  status: ProgressStatus;
  lastStep: number;
  stepKey?: string;
  accuracyPct?: number;
};

export type UpNextLesson = {
  lessonId: string;
  slug: string;
  title: string;
  /** Null when the lesson row is gone and only the progress row survives. */
  level?: number | null;
  part?: number | null;
  prefecture?: string;
  /** Where to resume. */
  href: string;
  lastStep: number;
  accuracyPct?: number;
  status: ProgressStatus;
};
