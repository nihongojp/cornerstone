import { Router } from "express";
import { listNewLessons, getNewLessonBySlug } from "../controllers/newLessonController";

const router = Router();

// GET /api/newlessons
router.get("/", listNewLessons);

// GET /api/newlessons/:slug
router.get("/:slug", getNewLessonBySlug);

export default router;
