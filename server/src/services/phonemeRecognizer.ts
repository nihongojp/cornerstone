import { AutoModelForCTC, AutoProcessor, env, PreTrainedModel, Processor } from "@huggingface/transformers";
import path from "path";
import { normalizePhonemeToken } from "../utils/phoneticFeatures";

// wav2vec2 fine-tuned on espeak-ng phonetic labels across ~60 CommonVoice
// languages (Japanese included). CTC output reflects what was acoustically
// heard rather than snapping to the nearest dictionary word/phrase — unlike
// Whisper-style ASR, so it doesn't paper over real mispronunciation.
const MODEL_ID = "onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX";

// This checkpoint only ships a legacy (vocab.json-based) tokenizer, not a
// fast tokenizer.json, so `AutoTokenizer`/the `pipeline()` helper can't load
// it. We don't need the tokenizer abstraction anyway — only its vocab, to
// turn predicted ids back into phoneme strings — so we load the model and
// feature-extractor directly and do the CTC decode ourselves below.
const VOCAB_URL = `https://huggingface.co/${MODEL_ID}/resolve/main/vocab.json`;

// Weights are fetched from the HF Hub on first use and cached here (gitignored).
env.cacheDir = path.join(__dirname, "..", "..", ".model-cache");

type Loaded = { model: PreTrainedModel; processor: Processor; id2token: string[]; specialIds: Set<number> };

let loadPromise: Promise<Loaded> | null = null;

async function loadVocab(): Promise<{ id2token: string[]; specialIds: Set<number> }> {
  const res = await fetch(VOCAB_URL);
  if (!res.ok) throw new Error(`Failed to fetch vocab.json (${res.status})`);
  const vocab = (await res.json()) as Record<string, number>;

  const id2token: string[] = [];
  for (const [token, id] of Object.entries(vocab)) {
    id2token[id] = token;
  }
  // <pad>/<s>/</s>/<unk> — stripped from decoded output, matching the
  // reference Wav2Vec2PhonemeCTCTokenizer's skip_special_tokens behavior.
  const specialIds = new Set<number>();
  for (const special of ["<pad>", "<s>", "</s>", "<unk>"]) {
    if (vocab[special] !== undefined) specialIds.add(vocab[special]);
  }
  return { id2token, specialIds };
}

function load(): Promise<Loaded> {
  if (!loadPromise) {
    console.log("[phonemeRecognizer] loading model (first call may download weights)...");
    const startedAt = Date.now();
    loadPromise = (async () => {
      const [model, processor, { id2token, specialIds }] = await Promise.all([
        AutoModelForCTC.from_pretrained(MODEL_ID, { dtype: "q8" }),
        AutoProcessor.from_pretrained(MODEL_ID),
        loadVocab(),
      ]);
      console.log(`[phonemeRecognizer] model ready in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (vocab size: ${id2token.filter(Boolean).length})`);
      return { model, processor, id2token, specialIds };
    })();
  }
  return loadPromise;
}

function argmax(data: ArrayLike<number>): number {
  let bestIdx = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] > bestVal) {
      bestVal = data[i];
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Collapses raw per-frame CTC predictions into phoneme tokens: merge
 * consecutive repeats, then drop special/blank ids. Mirrors the reference
 * Wav2Vec2PhonemeCTCTokenizer's decode (which transformers.js's generic
 * "CTC" tokenizer decoder can't reproduce for multi-character phoneme units).
 */
function ctcDecode(ids: number[], id2token: string[], specialIds: Set<number>): string[] {
  const collapsed: number[] = [];
  for (const id of ids) {
    if (collapsed[collapsed.length - 1] !== id) collapsed.push(id);
  }
  return collapsed
    .filter((id) => !specialIds.has(id))
    .map((id) => id2token[id])
    .filter(Boolean)
    .map(normalizePhonemeToken);
}

/**
 * Runs phoneme-level CTC recognition on 16kHz mono PCM audio and returns the
 * recognized phoneme tokens, in order.
 */
export async function recognizePhonemes(pcm16k: Float32Array): Promise<string[]> {
  const { model, processor, id2token, specialIds } = await load();

  const inputs = await processor(pcm16k);
  const output = await model(inputs);
  const logits = (output as any).logits[0];

  const predictedIds: number[] = [];
  for (const frame of logits) {
    predictedIds.push(argmax(frame.data));
  }

  return ctcDecode(predictedIds, id2token, specialIds);
}

/** Kicks off model loading without waiting — call at server startup to avoid a cold first request. */
export function warmPhonemeRecognizer(): void {
  load().catch((err) => {
    console.error("[phonemeRecognizer] failed to preload model:", err?.message || err);
  });
}
