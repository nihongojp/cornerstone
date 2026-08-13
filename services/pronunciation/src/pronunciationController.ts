import { RequestHandler } from "express";
import { decodeToPcm16k, PHONEME_SAMPLE_RATE } from "./audioDecode";
import { recognizePhonemes } from "./phonemeRecognizer";
import { alignPhonemes } from "./phonemeAlign";

// Reference audio is static content per exercise — cache its recognized
// phonemes by URL so repeat attempts don't re-run the model on it.
const REFERENCE_CACHE_MAX = 500;
const referencePhonemeCache = new Map<string, string[]>();

async function getReferencePhonemes(audioUrl: string, rid: string): Promise<string[]> {
  const cached = referencePhonemeCache.get(audioUrl);
  if (cached) {
    console.log(`[PRONUNCIATION][${rid}] reference cache HIT: ${audioUrl}`);
    return cached;
  }

  console.log(`[PRONUNCIATION][${rid}] reference cache MISS — fetching + analyzing: ${audioUrl}`);
  const res = await fetch(audioUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch reference audio (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`[PRONUNCIATION][${rid}] reference audio fetched: ${buffer.length} bytes`);
  const pcm = await decodeToPcm16k(buffer);
  console.log(`[PRONUNCIATION][${rid}] reference decoded to PCM: ${pcm.length} samples (${(pcm.length / PHONEME_SAMPLE_RATE).toFixed(2)}s)`);
  const phonemes = await recognizePhonemes(pcm);
  console.log(`[PRONUNCIATION][${rid}] reference phonemes (${phonemes.length}): ${phonemes.join(" ") || "(empty — silence or no speech detected)"}`);

  if (referencePhonemeCache.size >= REFERENCE_CACHE_MAX) {
    const oldestKey = referencePhonemeCache.keys().next().value;
    if (oldestKey !== undefined) referencePhonemeCache.delete(oldestKey);
  }
  referencePhonemeCache.set(audioUrl, phonemes);
  return phonemes;
}

export const checkPronunciation: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const referenceAudioUrl = (req.body?.referenceAudioUrl || "") as string;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!referenceAudioUrl) {
      res.status(400).json({ error: "referenceAudioUrl is required" });
      return;
    }
    if (!file || !file.buffer?.length) {
      res.status(400).json({ error: "recording file is required" });
      return;
    }

    console.log(`[PRONUNCIATION][${rid}] request: referenceAudioUrl=${referenceAudioUrl} recordingBytes=${file.buffer.length} mimeType=${file.mimetype}`);

    const [expectedPhonemes, userPcm] = await Promise.all([
      getReferencePhonemes(referenceAudioUrl, rid),
      decodeToPcm16k(file.buffer),
    ]);
    console.log(`[PRONUNCIATION][${rid}] recording decoded to PCM: ${userPcm.length} samples (${(userPcm.length / PHONEME_SAMPLE_RATE).toFixed(2)}s)`);
    const userPhonemes = await recognizePhonemes(userPcm);
    console.log(`[PRONUNCIATION][${rid}] recording phonemes (${userPhonemes.length}): ${userPhonemes.join(" ") || "(empty — silence or no speech detected)"}`);

    const { score, ops } = alignPhonemes(expectedPhonemes, userPhonemes);
    const opCounts = ops.reduce<Record<string, number>>((acc, op) => {
      acc[op.type] = (acc[op.type] ?? 0) + 1;
      return acc;
    }, {});
    const subs = ops.filter((op) => op.type === "sub");
    console.log(`[PRONUNCIATION][${rid}] result: score=${score.toFixed(3)} ops=${JSON.stringify(opCounts)}`);
    if (subs.length > 0) {
      const subDetail = subs.map((op) => `${op.expected}->${op.actual}(${op.cost.toFixed(2)})`).join(", ");
      console.log(`[PRONUNCIATION][${rid}] substitutions (expected->actual, cost 0=identical..1=unrelated): ${subDetail}`);
    }

    res.status(200).json({
      score,
      expectedPhonemes,
      userPhonemes,
      ops,
    });
  } catch (err: any) {
    console.error(`[PRONUNCIATION][${rid}] error`, err?.message || err);
    res.status(500).json({ error: "Internal error", details: err?.message || String(err) });
  }
};
