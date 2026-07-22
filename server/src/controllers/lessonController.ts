// src/controllers/lessonController.ts
import { RequestHandler } from "express";
import { Lesson } from "../models/Lesson";

const isObjectId = (s: string) => /^[a-fA-F0-9]{24}$/.test(s);

/**
 * GET /lessons?prefecture=Hokkaido
 * Dashboard uses this.
 */
export const listLessons: RequestHandler = (req, res) => {
  void (async (): Promise<void> => {
    try {
      const prefecture =
        typeof req.query.prefecture === "string"
          ? req.query.prefecture.trim()
          : "";

      const query: any = {}; // ❌ removed isActive filter

      if (prefecture) query.prefecture = prefecture;

      const lessons = await Lesson.find(query)
        .select("slug title version cardTitle flashcards prefecture isActive")
        .sort({ createdAt: 1 })
        .lean();

      res.status(200).json({ lessons });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Server error" });
    }
  })();
};

/**
 * GET /lessons/:lessonId
 * lessonId can be slug or Mongo _id (optional).
 */
export const getLessonById: RequestHandler = (req, res) => {
  void (async (): Promise<void> => {
    try {
      const { lessonId } = req.params;

      const query: any = { $or: [{ slug: lessonId }] };
      if (isObjectId(lessonId)) query.$or.push({ _id: lessonId });

      const lesson = await Lesson.findOne(query).lean();

      if (!lesson) {
        res.status(404).json({ error: "Lesson not found" });
        return;
      }

      res.status(200).json({ lesson });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Server error" });
    }
  })();
};

/**
 * POST /lessons
 * Create single lesson (slug + title + prefecture required)
 */
export const createLesson: RequestHandler = (req, res) => {
  void (async (): Promise<void> => {
    try {
      const slug = String(req.body?.slug || "").trim();
      const title = String(req.body?.title || "").trim();
      const prefecture = String(req.body?.prefecture || "").trim();

      if (!slug) {
        res.status(400).json({ error: "slug is required" });
        return;
      }
      if (!title) {
        res.status(400).json({ error: "title is required" });
        return;
      }
      if (!prefecture) {
        res.status(400).json({ error: "prefecture is required" });
        return;
      }

      const exists = await Lesson.exists({ slug });
      if (exists) {
        res.status(409).json({ error: "Lesson slug already exists" });
        return;
      }

      const doc = await Lesson.create(req.body);
      res.status(201).json({ lesson: doc });
    } catch (e: any) {
      res.status(500).json({
        error: e?.message || "Server error",
        details: e?.errors ? Object.keys(e.errors) : undefined,
      });
    }
  })();
};

/**
 * PATCH /lessons/:id
 * Update by slug OR Mongo _id.
 */
export const updateLesson: RequestHandler = (req, res) => {
  void (async (): Promise<void> => {
    try {
      const { id } = req.params;
      const filter = isObjectId(id) ? { _id: id } : { slug: id };

      const doc = await Lesson.findOneAndUpdate(filter, req.body, {
        new: true,
        runValidators: true,
      });

      if (!doc) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.status(200).json({ lesson: doc });
    } catch (e: any) {
      res.status(500).json({
        error: e?.message || "Server error",
        details: e?.errors ? Object.keys(e.errors) : undefined,
      });
    }
  })();
};
