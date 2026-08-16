import crypto from "crypto";
import express, { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { checkPronunciation } from "./pronunciationController";
import { isPhonemeRecognizerReady, warmPhonemeRecognizer } from "./phonemeRecognizer";

// This service is reachable only server-to-server (the Next.js app proxies to
// it). There is no user auth here — a single shared secret is the whole
// boundary, so refuse to boot without one rather than come up open.
const SERVICE_SECRET = process.env.PRONUNCIATION_SERVICE_SECRET;
if (!SERVICE_SECRET) {
  throw new Error(
    "PRONUNCIATION_SERVICE_SECRET is not set — refusing to start an unauthenticated pronunciation service"
  );
}

const PORT = Number(process.env.PORT) || 5055;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — a few seconds of speech
});

/** Constant-time comparison so the secret can't be recovered by timing the 401s. */
function secretMatches(provided: unknown): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(SERVICE_SECRET as string);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const requireServiceSecret: RequestHandler = (req, res, next) => {
  if (!secretMatches(req.header("x-service-secret"))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

const app = express();
app.disable("x-powered-by");

// Unauthenticated on purpose: container platforms probe this before they can
// be handed a secret. It exposes no user data.
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, modelReady: isPhonemeRecognizerReady() });
});

app.post("/check", requireServiceSecret, upload.single("recording"), checkPronunciation);

// multer rejects oversized uploads by throwing — answer with JSON rather than
// express's default HTML error page, so the caller can surface something useful.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: err.message });
    return;
  }
  console.error("[pronunciation-service] unhandled error", err?.message || err);
  res.status(500).json({ error: "Internal error" });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[pronunciation-service] listening on ${PORT}`);
});

// Load the model now so the first real request doesn't pay for it. In the
// container the weights are already on disk (baked in at build time), so this
// is a local read rather than a download.
warmPhonemeRecognizer();
