import { RequestHandler } from "express";
import { NewLesson } from "../models/NewLesson";

/**
 * GET /api/newlessons
 * Returns a list of all active new lessons (same envelope pattern as listLessons).
 * Returns an array even if only one document exists today.
 */
export const listNewLessons: RequestHandler = (req, res) => {
  void (async (): Promise<void> => {
    try {
      const newLessons = await NewLesson.find({ isActive: { $ne: false } })
        .select("lesson slug isActive tags createdAt")
        .sort({ createdAt: 1 })
        .lean();

      res.status(200).json({ newLessons });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Server error" });
    }
  })();
};

/**
 * GET /api/newlessons/:slug
 * Returns a single new lesson by slug (full document including items[]).
 * Divergence from lessons: lessons also supports Mongo _id lookup; newlessons
 * uses slug only for now since new content is always authored with slugs.
 */
export const getNewLessonBySlug: RequestHandler = (req, res) => {
  void (async (): Promise<void> => {
    try {
      const { slug } = req.params;
      const newLesson = await NewLesson.findOne({ slug }).lean();

      if (!newLesson) {
        res.status(404).json({ error: "Lesson not found" });
        return;
      }

      res.status(200).json({ newLesson });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Server error" });
    }
  })();
};
