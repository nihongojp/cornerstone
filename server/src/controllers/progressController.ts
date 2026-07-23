// src/controllers/progressController.ts
import { RequestHandler } from "express";
import { UserProgress } from "../models/UserProgress";
import { Attempt } from "../models/Attempt";
import { Lesson } from "../models/Lesson";
import { AuthedRequest } from "../middleware/requireAuth";

export const upsertProgress: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const authed = req as AuthedRequest;
    const userId = authed.user?._id;

    if (!userId) {
      console.warn(`[PROGRESS][${rid}] unauthorized: missing req.user`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { lessonId, status, lastStep, accuracyPct, stepKey } = (req.body || {}) as {
      lessonId: string;
      status: "in_progress" | "completed";
      lastStep: number;
      accuracyPct?: number;
      stepKey?: string;
    };

    if (
      !lessonId ||
      typeof lastStep !== "number" ||
      !["in_progress", "completed"].includes(status)
    ) {
      console.warn(`[PROGRESS][${rid}] invalid payload`, {
        lessonId,
        status,
        lastStepType: typeof lastStep,
        accuracyPct,
      });
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const doc = await UserProgress.findOneAndUpdate(
      { userId, lessonId },
      {
        status,
        lastStep,
        accuracyPct: accuracyPct ?? 0,
        stepKey: stepKey ?? "",
        updatedAt: new Date(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`[PROGRESS][${rid}] upserted`, {
      id: String(doc._id),
      lessonId: doc.lessonId,
      lastStep: doc.lastStep,
      status: doc.status,
      accuracyPct: doc.accuracyPct,
    });

    res.status(200).json(doc);
    return;
  } catch (err: any) {
    console.error(`[PROGRESS][${rid}] error`, err?.message || err);
    res.status(500).json({ error: "Internal error", details: err?.message || String(err) });
    return;
  }
};

export const getProgressSummary: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const authed = req as AuthedRequest;
    const userId = authed.user?._id;

    if (!userId) {
      console.warn(`[PROGRESS][${rid}] summary unauthorized: missing req.user`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [byLesson, counts] = await Promise.all([
      UserProgress.find({ userId }).lean(),
      Attempt.aggregate([
        { $match: { userId } },
        { $group: { _id: "$result", count: { $sum: 1 } } },
      ]),
    ]);

    const totals: Record<string, number> = { correct: 0, incorrect: 0 };
    for (const c of counts) totals[c._id] = c.count;

    res.status(200).json({ lessons: byLesson, totals });
    return;
  } catch (err: any) {
    console.error(`[PROGRESS][${rid}] summary error`, err?.message || err);
    res.status(500).json({ error: "Internal error", details: err?.message || String(err) });
    return;
  }
};

export const getUpNextLesson: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const authed = req as AuthedRequest;
    const userId = authed.user?._id;

    if (!userId) {
      console.warn(`[PROGRESS][${rid}] up-next unauthorized: missing req.user`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const latest = await UserProgress.findOne({
      userId,
      status: "in_progress",
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!latest) {
      res.status(200).json({ upNext: null });
      return;
    }

    // lessonId is stored as slug
    const lesson = await Lesson.findOne({ slug: latest.lessonId })
      .select("slug title version prefecture flashcards")
      .lean();

    if (!lesson) {
      res.status(200).json({
        upNext: {
          lessonId: latest.lessonId,
          slug: latest.lessonId,
          title: "Continue lesson",
          version: "",
          prefecture: "",
          lastStep: latest.lastStep ?? 0,
          accuracyPct: latest.accuracyPct ?? 0,
          status: latest.status,
        },
      });
      return;
    }

    res.status(200).json({
      upNext: {
        lessonId: latest.lessonId,
        slug: lesson.slug,
        title: lesson.title,
        version: lesson.version,
        prefecture: lesson.prefecture,
        lastStep: latest.lastStep ?? 0,
        accuracyPct: latest.accuracyPct ?? 0,
        status: latest.status,
      },
    });
    return;
  } catch (err: any) {
    console.error(`[PROGRESS][${rid}] up-next error`, err?.message || err);
    res.status(500).json({ error: "Internal error", details: err?.message || String(err) });
    return;
  }
};

/**
 * GET /api/progress/:lessonId
 * Returns the current user's saved progress for one specific lesson (by
 * slug), or { progress: null } if they haven't started it — used to resume
 * a lesson at the exercise the user last saw.
 */
export const getProgressForLesson: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const authed = req as AuthedRequest;
    const userId = authed.user?._id;

    if (!userId) {
      console.warn(`[PROGRESS][${rid}] get-by-lesson unauthorized: missing req.user`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { lessonId } = req.params;
    if (!lessonId) {
      res.status(400).json({ error: "lessonId is required" });
      return;
    }

    const doc = await UserProgress.findOne({ userId, lessonId }).lean();
    res.status(200).json({ progress: doc ?? null });
    return;
  } catch (err: any) {
    console.error(`[PROGRESS][${rid}] get-by-lesson error`, err?.message || err);
    res.status(500).json({ error: "Internal error", details: err?.message || String(err) });
    return;
  }
};