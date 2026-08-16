import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/session";

/*
 * Proxies pronunciation scoring to the standalone container service.
 *
 * The ML pipeline (ffmpeg decode → wav2vec2 ONNX inference) can't run in a
 * Vercel function: the model weights, onnxruntime native binaries and bundled
 * ffmpeg exceed the bundle limit, and it needs to stay warm. It lives in
 * services/pronunciation/ instead. This route keeps the browser talking only
 * to our own origin, so the session cookie remains the single auth mechanism
 * and the service secret never reaches the client.
 *
 * Replaces the requireAuth-gated POST /api/pronunciation/check in the Express
 * app (multer is unnecessary — the Web FormData API handles the upload).
 */

// The old multer config capped uploads at 10MB.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const serviceUrl = process.env.PRONUNCIATION_SERVICE_URL;
  const serviceSecret = process.env.PRONUNCIATION_SERVICE_SECRET;
  if (!serviceUrl || !serviceSecret) {
    console.error("[pronunciation] service env vars are not configured");
    return NextResponse.json(
      { message: "Pronunciation scoring is unavailable" },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Expected multipart form data" }, { status: 400 });
  }

  const recording = form.get("recording");
  const referenceAudioUrl = form.get("referenceAudioUrl");

  if (!(recording instanceof File)) {
    return NextResponse.json({ message: "recording is required" }, { status: 400 });
  }
  if (typeof referenceAudioUrl !== "string" || !referenceAudioUrl) {
    return NextResponse.json({ message: "referenceAudioUrl is required" }, { status: 400 });
  }
  if (recording.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ message: "Recording is too large" }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append("recording", recording, "recording.webm");
  upstream.append("referenceAudioUrl", referenceAudioUrl);

  try {
    const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/check`, {
      method: "POST",
      headers: { "x-service-secret": serviceSecret },
      body: upstream,
    });

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[pronunciation] upstream request failed:", err);
    return NextResponse.json(
      { message: "Pronunciation service is unreachable" },
      { status: 502 }
    );
  }
}

export const dynamic = "force-dynamic";
