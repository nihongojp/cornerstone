# cornerstone-pronunciation

Phoneme-level pronunciation scoring as a standalone container service. Takes a
learner's recording plus a reference audio URL, and returns a 0–1 score with a
phoneme-by-phoneme diff.

Pipeline (lifted unchanged from the old Express app):

1. `audioDecode.ts` — ffmpeg-static decodes arbitrary input audio (webm/opus,
   mp3, wav, …) to mono 16kHz f32 PCM.
2. `phonemeRecognizer.ts` — a wav2vec2 CTC model
   (`onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX`) turns PCM into espeak-ng
   phoneme tokens.
3. `phonemeAlign.ts` / `phoneticFeatures.ts` — weighted edit-distance alignment
   of expected vs. recognized phonemes produces the score.

## Why it is not part of the Vercel app

It cannot run in a Vercel function:

- the ONNX model weights are ~300MB and `onnxruntime-node` ships native
  binaries;
- `ffmpeg-static` bundles a ~70MB ffmpeg binary;

which together blow well past the 250MB function bundle limit. Even if they
fit, a function's filesystem is ephemeral, so every cold start would
re-download the weights before it could answer.

So this runs as an always-on container with the weights baked into the image,
and the Next.js app calls it server-to-server.

## API

### `POST /check`

`multipart/form-data`:

| field               | type   | notes                                  |
| ------------------- | ------ | -------------------------------------- |
| `recording`         | file   | the learner's audio, 10MB cap          |
| `referenceAudioUrl` | string | URL of the exercise's reference clip    |

Header: `x-service-secret: <PRONUNCIATION_SERVICE_SECRET>` (401 without it).

`200` response:

```json
{
  "score": 0.82,
  "expectedPhonemes": ["k", "o", "ɴ", "n", "i", "tɕ", "i", "w", "a"],
  "userPhonemes": ["k", "o", "n", "i", "tɕ", "i", "w", "a"],
  "ops": [
    { "type": "match", "phoneme": "k" },
    { "type": "sub", "expected": "d", "actual": "ɾ", "cost": 0.18 },
    { "type": "del", "expected": "ɴ" },
    { "type": "ins", "actual": "ə" }
  ]
}
```

`score` is 0–1 (1 = perfect). Each op is one of `match` / `sub` / `del` /
`ins`; `sub.cost` is 0 (identical) to 1 (unrelated), phonetic-distance
weighted so accent-flavored near-misses are penalized less.

Errors: `400` missing `referenceAudioUrl` or `recording`, `401` bad/missing
secret, `413` recording over 10MB, `500` `{ error, details }`.

Reference-audio phonemes are cached in memory by URL (500 entries), so repeat
attempts on the same exercise only run the model on the learner's recording.

### `GET /health`

`{ "ok": true, "modelReady": true }` — unauthenticated, so platform probes can
reach it. `modelReady` is false during the first seconds after boot while the
model loads; `/check` still works then, it just waits for the load.

## Environment

| var                              | required | default | notes                                                          |
| -------------------------------- | -------- | ------- | -------------------------------------------------------------- |
| `PRONUNCIATION_SERVICE_SECRET`   | yes      | —       | shared secret for `x-service-secret`; the service refuses to start without it |
| `PORT`                           | no       | `5055`  |                                                                |

## Local development

```bash
npm install
PRONUNCIATION_SERVICE_SECRET=dev-secret npm run dev
```

First run downloads the model into `.model-cache/` (gitignored).

```bash
curl -sS http://localhost:5055/check \
  -H "x-service-secret: dev-secret" \
  -F "recording=@sample.webm" \
  -F "referenceAudioUrl=https://example.com/konnichiwa.mp3"
```

## Container

```bash
docker build -t cornerstone-pronunciation .
docker run --rm -p 5055:5055 \
  -e PRONUNCIATION_SERVICE_SECRET=dev-secret \
  cornerstone-pronunciation
```

`package-lock.json` is committed and the image builds with `npm ci`, so keep
the lockfile in the repo.

The build stage runs `scripts/prefetch-model.js`, which performs one real
inference pass and thereby writes the weights into `/app/.model-cache`; the
final stage copies that directory in. **The image is large (multiple GB) and
that is deliberate** — it buys cold starts that never touch the HuggingFace
Hub and never pay a download before the first response.

Caveat: `vocab.json` is still fetched from the Hub once at model load
(a few KB, at boot only, not per request). The container therefore needs
outbound HTTPS at startup, as it does anyway to fetch reference audio.

## Deploying

Any always-on container host works — Railway, Render, Fly.io, Cloud Run
(with min-instances ≥ 1), ECS. Requirements:

- **keep at least one instance warm.** Scale-to-zero throws away the loaded
  model and the first request after a wake pays several seconds of load time.
- **give it memory.** Model plus ONNX session wants ~1GB; 2GB is comfortable.
- set `PRONUNCIATION_SERVICE_SECRET` to the same value configured in the
  Next.js app, and point the platform's health check at `GET /health`.
- do not expose it publicly if you can avoid it — the shared secret is the
  only access control here.
