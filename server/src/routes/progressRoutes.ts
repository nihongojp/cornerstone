// src/routes/progressRoutes.ts
import { Router } from "express";
import {
  upsertProgress,
  getProgressSummary,
  getUpNextLesson,
  getProgressForLesson,
} from "../controllers/progressController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.post("/", requireAuth, upsertProgress);
router.get("/summary", requireAuth, getProgressSummary);
router.get("/up-next", requireAuth, getUpNextLesson);
// Must come after the literal routes above — "/:lessonId" would otherwise
// swallow "/summary" and "/up-next".
router.get("/:lessonId", requireAuth, getProgressForLesson);

export default router;