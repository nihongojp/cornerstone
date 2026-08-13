"use client";

/*
 * Same surface as the old client/src/services/pronunciation.ts. The axios
 * instance is gone; a plain fetch of FormData lets the browser set the
 * multipart boundary itself (the old code had to explicitly unset the shared
 * instance's JSON Content-Type to get the same effect).
 *
 * The request goes to our own route handler, which authenticates the session
 * and forwards to the pronunciation container — the browser never talks to
 * that service directly.
 */

export type PhonemeOp =
  | { type: "match"; phoneme: string }
  | { type: "sub"; expected: string; actual: string; cost: number } // cost in [0,1]; phonetically-close substitutions score better than unrelated ones
  | { type: "del"; expected: string }
  | { type: "ins"; actual: string };

export type PronunciationCheckResult = {
  score: number; // 0..1
  expectedPhonemes: string[];
  userPhonemes: string[];
  ops: PhonemeOp[];
};

/**
 * Uploads a recorded pronunciation attempt for phoneme-level scoring against
 * the exercise's reference audio.
 */
export async function checkPronunciation(
  recording: Blob,
  referenceAudioUrl: string
): Promise<PronunciationCheckResult> {
  const form = new FormData();
  form.append("recording", recording, "recording.webm");
  form.append("referenceAudioUrl", referenceAudioUrl);

  const res = await fetch("/api/pronunciation/check", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Pronunciation check failed (${res.status})`);
  }

  return res.json();
}
