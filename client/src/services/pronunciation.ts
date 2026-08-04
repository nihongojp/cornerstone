import api from "./api";

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

  const res = await api.post<PronunciationCheckResult>("/api/pronunciation/check", form, {
    // Let the browser set multipart/form-data with the correct boundary —
    // the shared axios instance defaults Content-Type to application/json.
    headers: { "Content-Type": undefined },
  });
  return res.data;
}
