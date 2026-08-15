# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cornerstone (branded "Nihon-Go!") is a full-stack MERN app for teaching Japanese language and culture: prefecture-based lessons, vocabulary/character exercises, and cultural content. TypeScript throughout.

This is an old first project (see `MIGRATION_EVALUATION.md`) with real content but also dead code/duplication accumulated over time — don't assume everything present is intentional or wired up.

## Repo layout

Monorepo, no root build tooling — `client/` and `server/` are independent npm projects with their own `package.json`/`node_modules`, run and developed separately.

- `client/` — Create React App (react-scripts 5.0.1) + TypeScript, MUI/Emotion, React Router 7, D3 (map viz), Framer Motion
- `server/` — Express + TypeScript + Mongoose/MongoDB
- `App_Overview.md` — a generated architecture doc; treat as a rough map, not ground truth — it predates several current features (e.g. the `newlessons` system, `ForgotPassword`) and mischaracterizes some pieces (e.g. it calls controllers/middleware "typically empty," which is no longer true)
- `MIGRATION_EVALUATION.md` — open decision doc on whether/how to migrate the client off CRA (to Vite, possibly later Next.js); read before doing anything to the build tooling

## Commands

Run these from `client/` or `server/` respectively — there is no root install/build/test.

**Server** (`server/`):
```bash
npm run dev     # nodemon + ts-node, hot reload, port 5001 (default)
npm run build   # tsc -> server/dist
npm start       # node dist/server.js (run build first)
```
No test suite is configured (`npm test` is a stub that exits 1).

**Client** (`client/`):
```bash
npm start       # react-scripts dev server, port 3000
npm run build   # react-scripts build, then MOVES build/* into ../docs (GitHub Pages deploy target)
npm test        # react-scripts test (Jest/CRA default), interactive watch mode
```
To run a single client test file: `npm test -- <FileName>` (CRA/Jest pattern match).

Note `client/build` gets moved (not copied) into `../docs` — running `npm run build` empties `client/build/`.

## Environment

Both apps read `.env` files (gitignored, not present in repo — must be created locally):
- `server/.env`: `MONGO_URI`, `PORT` (default 5001), `JWT_SECRET` (defaults to `"devsecret"` if unset — see `server/src/middleware/requireAuth.ts`)
- `client/.env`: `REACT_APP_API_BASE_URL` (CRA requires the `REACT_APP_` prefix; defaults to `http://localhost:5001` when on localhost, otherwise `window.location.origin`)

## Architecture

### Server: routes → controllers → models, JWT auth

`server/src/server.ts` wires everything: CORS (open, reflects request origin, credentials on), `body-parser`, Mongo connect, then mounts route modules under `/api/*`. Each `server/src/routes/*.ts` is thin and delegates to a same-named controller in `server/src/controllers/`.

Auth: `server/src/middleware/requireAuth.ts` reads `Authorization: Bearer <jwt>`, verifies against `JWT_SECRET`, loads the user, and attaches it to `req.user`. Apply it per-route (see `progressRoutes.ts`, `attemptsRoutes.ts`, `reviewRoutes.ts`, `userRoutes.ts`) — it is not global middleware. Some routes are intentionally public (`lessonRoutes.ts` GET/POST/PATCH, `resourceRoute.ts`, `newLessonRoutes.ts` currently have no `requireAuth`).

`galleryRoutes.ts`/`galleryController.ts`/`Gallery.ts` model exist but are commented out in `server.ts` and unused — don't wire them up without confirming that's wanted.

### Two parallel lesson systems

The codebase currently has **two independent lesson content systems** living side by side:

1. **Legacy lessons** — `Lesson.ts` model, `lessonRoutes.ts`/`lessonController.ts`, served at `/api/lessons`, consumed by `client/src/pages/Lesson.tsx` (route `/lesson/:lessonId`) via `client/src/services/lessons.ts`.
2. **New lessons** — `NewLesson.ts` model (`strict: false` schema — richer, evolving exercise item shapes not yet formalized), `newLessonRoutes.ts`/`newLessonController.ts`, served at `/api/newlessons`, consumed by `client/src/pages/NewLessonPage.tsx` / `NewLessonsListPage.tsx` (routes `/newlesson/:slug`, `/new-lessons`) via `client/src/services/newLessons.ts`.

Field naming differs between them (legacy uses `title`, new uses `lesson` for the display name) and is *not* yet normalized — see the comment in `NewLesson.ts`. After login, users land on `/new-lessons`, not the legacy `/dashboard` — the new system is the actively developed one; treat the legacy system as maintained-but-not-extended unless told otherwise. When adding lesson/exercise features, check which system the request is actually about before picking files to edit.

### Client auth model

JWT is stored in `localStorage` (`access_token`) and attached via an Axios request interceptor in `client/src/services/api.ts`. A response interceptor clears the token and force-redirects to `/auth` on any 401 from a non-auth endpoint. `RequireAuth`/`PublicOnly` wrappers in `client/src/App.tsx` are **UI-only route gating**; the real enforcement boundary is the Express `requireAuth` middleware server-side. Known weakness (tracked in `MIGRATION_EVALUATION.md`): token in `localStorage` is XSS-exposed; the fix under consideration is an httpOnly cookie, not yet implemented — don't assume it exists.

`client/src/services/api.ts` also silently rewrites legacy `/lessons/*` calls to `/api/lessons/*` — a backward-compat shim, not a routing convention to imitate in new code.

### Client routing/layout

Single `client/src/App.tsx` defines all routes. Header/Footer visibility is path-based (hidden on `/lesson*`, `/newlesson*`, and Footer also hidden on `/dashboard`) rather than per-route config — check `hideHeader`/`hideFooter` logic there before adding routes that need the same treatment.

### Exercise components

Several exercise/placeholder component pairs exist for the two lesson systems and are not 1:1 interchangeable — e.g. `DragDrop.tsx` vs `DragDropCombination.tsx`/`DragDropPlaceholder.tsx`, `MatchDots.tsx` vs `MatchDotsMedia.tsx`, `AudioMatch.tsx` vs `MatchAudioExercisePlaceholder.tsx`, plus newer `PronunciationExercise.tsx`/`SelfRecordButton.tsx`/`FlashcardReview.tsx`. Confirm which lesson system (legacy vs new) a component belongs to before reusing it.

### Pronunciation scoring pipeline

`POST /api/pronunciation/check` (`pronunciationRoutes.ts`, `requireAuth`-gated, `multer` memory storage, 10MB cap) accepts a recorded audio blob + a `referenceAudioUrl`, and returns a phoneme-level diff/score. Flow, all server-side:

1. `server/src/utils/audioDecode.ts` shells out to `ffmpeg-static` (bundled binary, no system ffmpeg needed) to decode arbitrary input audio (webm/opus, mp3, wav, ...) to mono 16kHz f32 PCM.
2. `server/src/services/phonemeRecognizer.ts` runs a wav2vec2 CTC model (`onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX`, via `@huggingface/transformers`) to turn PCM into espeak-ng phoneme tokens. Model weights download from the HF Hub on first use and cache in `server/.model-cache/` (gitignored); `warmPhonemeRecognizer()` is fired at server startup in `server.ts` to avoid a cold first request. Reference-audio phonemes are additionally cached in-memory by URL (`pronunciationController.ts`) so repeat attempts against the same exercise don't re-run the model.
3. `server/src/utils/phonemeAlign.ts` aligns expected vs. recognized phoneme sequences (edit-distance style match/sub/del/ins ops) to produce a 0–1 score.

Client side: `client/src/services/pronunciation.ts` posts the recording as `multipart/form-data` (overriding the shared axios instance's default JSON content-type) to this endpoint; `client/src/components/PronunciationExercise.tsx` is the consumer, paired with `SelfRecordButton.tsx` for capture. This is new-lesson-system-only content — no legacy-lesson equivalent exists.

## Cursor rules

`.cursor/rules/always-work-on-master.mdc` (applies to all agents in this repo): always work on `master`; never check out `cursor/forgot-password-page` unless explicitly asked; if switched there by tooling, switch back to `master` immediately; prefer merging needed work into `master` over continuing on that branch.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (Sachi2631/Cornerstone) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by /domain-modeling). See `docs/agents/domain.md`.
