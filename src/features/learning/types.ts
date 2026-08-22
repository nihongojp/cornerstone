export type ProgressStatus = "in_progress" | "completed";

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
