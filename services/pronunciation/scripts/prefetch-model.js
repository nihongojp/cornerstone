// Run during `docker build` (see Dockerfile) to populate .model-cache with the
// wav2vec2 weights, so the shipped image never has to reach the HuggingFace
// Hub for them at runtime.
//
// It runs one real inference pass over a second of silence rather than just
// loading the files: that also proves the onnxruntime-node native binary works
// in the image, so a broken build fails here instead of on a user's request.
const { recognizePhonemes } = require("../dist/phonemeRecognizer");

const PHONEME_SAMPLE_RATE = 16000;

(async () => {
  const startedAt = Date.now();
  await recognizePhonemes(new Float32Array(PHONEME_SAMPLE_RATE));
  console.log(`[prefetch-model] weights cached and inference verified in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
})().catch((err) => {
  console.error("[prefetch-model] failed:", err && err.message ? err.message : err);
  process.exit(1);
});
