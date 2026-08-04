import { Router } from "express";
import multer from "multer";
import { checkPronunciation } from "../controllers/pronunciationController";
import { requireAuth } from "../middleware/requireAuth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — a few seconds of speech
});

const router = Router();
router.post("/check", requireAuth, upload.single("recording"), checkPronunciation);
export default router;
