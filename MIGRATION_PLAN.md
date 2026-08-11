# Cornerstone: CRA + Express → Next.js on Vercel

## Context

Cornerstone (Japanese learning app) is a two-package repo: `client/` (CRA/react-scripts 5, React 19, TS pinned 4.9, MUI 6, react-router v7, ~11k LOC) and `server/` (Express 4 + Mongoose 8 with working JWT auth, users, and per-user lesson progress, ~1.5k LOC). CRA is dead tooling, the deploy path (GitHub Pages via `mv build/* ../docs`) is broken, and the existing auth has serious holes: `POST /api/auth/reset-password` lets anyone take over any account with just an email (verified `authController.ts:151`), `JWT_SECRET` falls back to `"devsecret"`, JWT lives in localStorage, CORS reflects any origin, and lesson write endpoints are unauthenticated.

**Decisions (user-confirmed):**
- **Next.js App Router on Vercel** — single app replacing both `client/` and `server/`
- **Better Auth + Postgres (Neon)** for users, sessions, and progress
- **Airtable** as the content backend for courses/lessons (replaces MongoDB + Compass authoring; Airtable *is* the new admin UI)
- **Scope: stack migration only** — port both lesson players and all pages as-is; no feature redesign. Security fixes come free with the auth rework.
- **Migrate everything**: lesson content Mongo→Airtable, user accounts (bcrypt hashes intact) Mongo→Postgres, progress records Mongo→Postgres

**Update (merged latest master, 68bc9b1):** master brought ~4.4k new lines that this plan now accounts for: a server-side **pronunciation scoring pipeline** (`POST /api/pronunciation/check`: multer upload → ffmpeg-static decode → wav2vec2 ONNX phoneme CTC via `@huggingface/transformers` → phoneme alignment/score), new exercise types (`factBreak`, `DragDropCombination`, lesson chaining via `NewLesson.nextSlug`, `Lesson.flashcardsAudio`), new client utils (`kana.ts`, `buildChoiceOptions.ts`, `dotMatchArrangement.ts`, `SelfRecordButton.tsx`), and a repo `CLAUDE.md`. The pronunciation pipeline is the one piece that **cannot run in a Vercel function** (see its section below).

## Target layout (repo root; `client/` + `server/` untouched until cutover)

```
package.json  next.config.ts  tsconfig.json  drizzle.config.ts
public/                    # copied from client/public (assets/, japan.geojson, icons)
src/
  middleware.ts            # optimistic session-cookie check on protected paths
  theme.ts                 # ported client/src/theme.ts (finally mounted)
  app/
    layout.tsx             # AppRouterCacheProvider + ThemeRegistry + metadata
    (site)/                # Header + Footer chrome
      layout.tsx
      page.tsx  funfacts/  gallery/  stories/  characters/[id]/  resources/
      (public-only)/       # layout: session → redirect /new-lessons
        auth/  login/  signup/  forgot-password/  reset-password/   # reset-password is NEW (token landing)
      (protected)/         # layout: no session → redirect /auth
        new-lessons/  watch/  talk/  profile/
    (dashboard)/           # Header, no Footer
      layout.tsx  dashboard/page.tsx
    (player)/              # no Header/Footer (matches /lesson*, /newlesson* today)
      layout.tsx
      lesson/[lessonId]/page.tsx      # server fetch → <LessonPlayer/>
      newlesson/[slug]/page.tsx       # server fetch → <NewLessonPlayer/>
    api/
      auth/[...all]/route.ts          # Better Auth handler
      progress/route.ts  progress/up-next/route.ts  progress/[lessonId]/route.ts
      revalidate/route.ts             # Airtable automation webhook → revalidateTag
  components/              # ported verbatim, all "use client"
  pages-client/            # ported page bodies as client components
  data/  utils/            # expandLessonItems.ts + termMedia.ts UNCHANGED
  lib/
    auth.ts  auth-client.ts
    db/{index,schema,auth-schema}.ts
    airtable/{client,content,adapters,media}.ts
    types/lessons.ts       # existing TS shapes copied verbatim from client services
    progress-client.ts     # same exports as client/src/services/progress.ts
scripts/migrate/
  01-content-to-airtable.ts  02-users-to-postgres.ts  03-progress-to-postgres.ts  lib/mongo.ts
```

- `/charinfo → /gallery` becomes a `redirects()` entry in next.config.ts; `*` catch-all → redirect `/`. `ScrollToTop` dropped (App Router default). The sticky-header `Box sx` wrapper from `App.tsx:91` moves into a small client component in the `(site)` layout.
- Packages: `next@^16` (fallback 15.5), `react@^19`, MUI 6.4 + `@mui/material-nextjs`, `better-auth@^1.4`, `drizzle-orm` + `drizzle-kit`, `@neondatabase/serverless`, `bcryptjs` (pure JS — native `bcrypt` breaks Vercel builds), `resend`, `@vercel/blob`, `tsx` + `mongodb` (scripts only), `typescript@^5.7`. Delete: axios, react-scripts, cra-template, web-vitals, `@types/react-router-dom`.

## Postgres + Drizzle

Drizzle over Prisma: Better Auth CLI generates the Drizzle auth schema (`user`/`session`/`account`/`verification`), the neon-http driver is serverless-safe, and there's only one custom table. **Drop dead models**: `Attempt`, `ReviewItem` (only writer is the no-op `submitAttempt()` stub — keep the stub export so player code ports unchanged), `Gallery`, `Unit`.

`user_progress` (1:1 port of `server/src/models/UserProgress.ts`): `id` (uuid pk), `user_id` → user.id cascade, `lesson_id` (slug, text), `status` enum in_progress|completed, `last_step` int, `step_key` text (opaque content-derived resume key — the stepKey mechanism in `NewLessonPage.tsx:33` needs zero changes), `accuracy_pct` real, timestamps, **unique (user_id, lesson_id)**.

## Better Auth

- `secret: process.env.BETTER_AUTH_SECRET` with **no fallback** (kills devsecret); sessions 7d in httpOnly cookies (kills localStorage JWT); `cookieCache` on.
- **Imported bcrypt hashes**: custom `emailAndPassword.password.verify` — if hash starts with `$2` → `bcryptjs.compare`, else default scrypt. New/changed passwords get scrypt. No forced resets.
- **Password reset**: Better Auth tokenized email flow via Resend (`sendResetPassword`) + new `/reset-password` page. The account-takeover endpoint ceases to exist.
- `user.additionalFields`: firstName, lastName, role (default "Volunteer"); `deleteUser` + `changeEmail` enabled (powers Profile page).
- **Enforcement**: middleware does optimistic `getSessionCookie()` redirect (`?from=` preserves return path); real checks are `auth.api.getSession()` in the `(protected)`/`(dashboard)`/`(player)` layouts + every progress route handler. Never import Drizzle/Neon in middleware.
- **Client**: `createAuthClient` from `better-auth/react`. AuthForm's full-page reload after login (`AuthForm.tsx:111`) → `router.push + router.refresh`; Header's storage-event/token code → `useSession()` (cross-tab sync free); `Home.tsx:31` localStorage-read-during-render (SSR-fatal) → `useSession()`; Profile's four endpoints → `updateUser`/`changeEmail`/`changePassword`/`deleteUser`.

## Airtable content layer

**Schema — hybrid**: real fields for filterable metadata, JSON-in-long-text for lesson bodies. (Linked-records-per-item rejected: `NewLesson.items[]` is heterogeneous, nested, order-sensitive, and `termMedia.ts` assumes whole-lesson JSON; a JSON field in Airtable's expanded view matches today's Compass authoring model with a better UI.)

Base "Cornerstone Content":
- **Lessons**: Slug (primary), Title, CardTitle, Version, Prefecture (single-select, 47 opts), FunFact, Notes, Flashcards (JSON), FlashcardsAudio (JSON — per-card pronunciation URLs, new on master), Exercises (JSON — now includes `factBreak` type + `bonus`/`title`/`content` fields), Achievement (JSON), IsActive, Tags, SourceId (Mongo `_id` hex — idempotency + legacy `/lesson/<ObjectId>` URL fallback)
- **NewLessons**: Slug (primary), Lesson (title), CardTitle, Items (JSON, verbatim Mongo shape — includes the new pronunciationExercise fields `transcript`/`videoUrl`/`audioUrl`), NextSlug (single line — lesson chaining, l1-v1 → l1-v2), IsActive, Tags, SourceId
- **Resources**: ResourceId (primary), Category, Items (JSON)

Hardcoded content (FunFacts/Gallery/Stories/CharInfo in `src/data/`) stays hardcoded — out of scope.

**Access layer**:
- `airtable/client.ts`: plain `fetch` (NOT the airtable npm package — bypasses Next data cache) with `next: { revalidate: 300, tags }`, offset pagination. Key stays server-only.
- `airtable/content.ts`: `listLessons`, `getLessonBySlug` (slug, then SourceId fallback), `listNewLessons`, `getNewLessonBySlug`, `getResources` — tagged for revalidation.
- `airtable/adapters.ts`: pure record→existing-TS-shape transforms (`lib/types/lessons.ts` copied verbatim), `JSON.parse` in try/catch — **fail soft** on author typos (skip record + log, never 500).
- **Fetching pattern**: thin server-component page wrappers pass props into ported client players (players drop their fetch useEffect + loading state; everything else unchanged). Progress stays client-fetched via route handlers (saves happen at arbitrary interaction points; `lib/progress-client.ts` mirrors today's signatures incl. swallow-errors-to-null).
- **Rate limit (5 req/s)**: data cache means ~1 req/table/5min. On-demand: `api/revalidate` route (secret-checked) + Airtable Automation on record update → author edits live within seconds.
- **Media**: existing URL strings in JSON migrate verbatim. New Airtable *attachments* (URLs expire ~2h) get mirrored to Vercel Blob in the adapter at cache-miss time (`head()`/`put()` keyed `media/{attachmentId}/{filename}`) → players always receive permanent CDN URLs.

## Pronunciation scoring service (new since original plan)

The pipeline (ffmpeg decode → wav2vec2-large q8 ONNX inference → phoneme alignment) is incompatible with Vercel functions: ~300MB model weights + onnxruntime-node native binaries + ~70MB ffmpeg-static exceed the 250MB bundle limit, cold starts would re-download weights to the ephemeral FS, and model load alone takes seconds. **Decision: extract it as a standalone always-warm service; Next.js proxies to it.**

- **`services/pronunciation/`** in-repo: move `server/src/services/phonemeRecognizer.ts`, `server/src/utils/{audioDecode,phonemeAlign,phoneticFeatures}.ts` + the controller logic behind a minimal Express (or Hono) app with one endpoint, `POST /check`, guarded by a shared-secret header. Dockerfile bakes the model weights into the image at build time (`.model-cache/` pre-populated) so cold starts never hit the HF Hub. Deploy to Railway/Render/Fly (any container host with an always-on instance); keep `warmPhonemeRecognizer()` at startup and the in-memory reference-phoneme URL cache.
- **Next.js side**: `src/app/api/pronunciation/check/route.ts` — Better Auth session check (this replaces the old `requireAuth` gate), read `request.formData()` natively (no multer; enforce the 10MB cap), forward recording + `referenceAudioUrl` server-to-server with the secret header, stream the JSON verdict back. Client `lib/pronunciation-client.ts` keeps the exact `checkPronunciation(recording, referenceAudioUrl)` signature from `client/src/services/pronunciation.ts`, as a same-origin `fetch` + FormData (cookie auth rides along) — `PronunciationExercise.tsx`/`SelfRecordButton.tsx` port unchanged.
- Rejected alternatives: hosted inference (Replicate/Modal/HF endpoints — per-call cost + latency, and the espeak CTC decode is custom) and in-browser transformers.js (~300MB model download to every client).

## Port mechanics

- Every page body is `"use client"`; server components only do layouts/fetching/handlers and **never render MUI sx**.
- Root layout: `<AppRouterCacheProvider>` (`@mui/material-nextjs`) + client ThemeRegistry (`ThemeProvider` + `CssBaseline`). Check a production build early — missing cache provider only shows as FOUC in prod.
- Mechanical mappings: `useNavigate→useRouter`, `useParams` (or prop from server wrapper), `useLocation().pathname→usePathname`, `location.state.from→searchParams.get("from")`, `<Link to→href>`, `<Navigate>→redirect()/router.replace`.
- `services/api.ts` deleted entirely (cookies ride same-origin; 401 handling replaced by server-side gating). Legacy path-rewrite shims (`api.ts:86`, `lessons.ts:58 getWithFallback`) die, don't port.
- Browser-only APIs (MediaRecorder in PronunciationExercise, AudioContext in Talk, D3 DOM in Dashboard) are SSR-safe as client components (all in handlers/effects). If a hydration issue appears, `dynamic(ssr:false)` must live in a client parent (Next 15+ forbids it in server components).
- **Critical — expandLessonItems shuffle**: it re-shuffles with `Math.random()` per visit; with data arriving as props it would run in SSR + again on hydration → mismatch. Fix: initialize via `useEffect(() => setItems(expandLessonItems(lesson.items)), [lesson])`, render existing loading UI until set. Preserves per-visit shuffle + stepKey resume.
- japan.geojson (12.4MB) stays in `public/`, client-fetched — TopoJSON conversion is a noted follow-up, out of scope.

## Migration scripts (`scripts/migrate/`, run via `npx tsx`, raw mongodb driver, idempotent)

1. **01-content-to-airtable**: read `lessons`/`newlessons`/`resources`; PATCH with `performUpsert` merging on Slug/ResourceId, batches of 10, ≥300ms sleep (<5 req/s). Assert JSON bodies <95k chars (Airtable long-text limit; escape hatch: split Items/Items2). Ends with verify pass: re-fetch, parse, deep-compare vs Mongo, print diffs.
2. **02-users-to-postgres**: `user.id` = **Mongo `_id` hex** (makes script 03 trivial + idempotent), name/firstName/lastName/role/email, `emailVerified: true`; `account` row `{providerId: "credential", password: <bcrypt hash verbatim>}`. **Legacy plaintext passwords** (old login tolerated them, `authController.ts:92-104`): bcrypt-hash during import or those users can never log in. `onConflictDoNothing`, log skips.
3. **03-progress-to-postgres**: `userprogresses` → `user_progress` (userId = same hex), `onConflictDoUpdate` on (user_id, lesson_id) keeping newer updatedAt; skip rows whose user wasn't migrated; print counts.

## Env vars (Vercel + `.env.local`)

`DATABASE_URL` (Neon pooled), `BETTER_AUTH_SECRET` (no fallback), `BETTER_AUTH_URL`, `AIRTABLE_API_KEY` (PAT, read scope; write only during migration), `AIRTABLE_BASE_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `REVALIDATE_SECRET`, `BLOB_READ_WRITE_TOKEN` (auto), `PRONUNCIATION_SERVICE_URL` + `PRONUNCIATION_SERVICE_SECRET` (Next → pronunciation service), `MONGODB_URI` (**local only**, scripts).

## Phases (each ends deployable; old stack runs in parallel until cutover)

- **P0 — Scaffold + static pages**: root Next app, MUI setup, layouts/route groups, port public pages + Header/Footer + data/ + public/. Gate: `tsc --noEmit` + `next build` clean; smoke all 6 public pages on a Vercel preview, `/charinfo` redirect works, prod build has no FOUC.
- **P1 — Postgres + Better Auth**: Neon, Drizzle migrations, auth config/handler/middleware/layouts, port AuthForm/ForgotPassword/Profile, new reset-password page, Resend. Smoke: signup, logout/login, cookie is httpOnly, logged-out `/dashboard` redirects, reset-email round trip, change password, delete account.
- **P2 — Airtable content**: base/tables, run script 01 against a Mongo copy, client/content/adapters/revalidate, port Resources. Smoke: verify pass zero diffs; `/resources` identical; Airtable edit → live within seconds.
- **P3 — Lessons + progress + pronunciation service**: port NewLessonsListPage + both players (shuffle-in-effect fix) + progress handlers/client, incl. the new utils/components from master (`kana.ts`, `buildChoiceOptions.ts`, `dotMatchArrangement.ts`, `DragDropCombination`, `SelfRecordButton`) — verbatim ports. Extract + deploy `services/pronunciation/` (Docker, model baked in) and wire the Next proxy route. Smoke: merged lesson list; play a grammar lesson end-to-end (audio, matching, drag-drop combination, factBreak); **pronunciation check round-trips with a real score**; lesson chaining (`nextSlug` → Continue); **Save & Exit mid-lesson → reopen → resumes at same exercise despite re-shuffle (stepKey)**; complete a lesson; typed `/lesson/<slug>` flow incl. flashcardsAudio playback.
- **P4 — Dashboard/Watch/Talk + migration rehearsal**: port remaining pages; run scripts 02+03 against staging with a prod Mongo snapshot. Smoke: map zoom/prefecture→lessons/up-next; **log in as a migrated user with their old password** (decisive bcrypt test); their progress appears.
- **P5 — Parity pass**: side-by-side click-through of every route, old vs new; coordinate content freeze (Compass edits stop).
- **P6 — Cutover**: content freeze → final runs of scripts 01/02/03 → domain to Vercel → prod smoke → delete `client/`/`server/`/`docs` path (pronunciation code already extracted to `services/pronunciation/`), retire Express host; rewrite `CLAUDE.md` and `.cursor/rules/always-work-on-master.mdc` for the new stack; keep final Mongo dump + read-only cluster 30 days.

- **P7 — Developer migration guide** (after everything else is done): write `MIGRATION_GUIDE.md` at repo root for the other devs — what changed and why; old→new concept mappings (CRA scripts → Next App Router, react-router routes → `src/app/` file routing + route groups, axios/localStorage JWT → Better Auth httpOnly cookie sessions + `useSession`, Express routes/controllers → server components + route handlers, Mongoose/Compass → Drizzle/Postgres + Airtable authoring, GitHub Pages → Vercel, pronunciation carve-out); a "new stuff you may not know" section with links to official learning resources (Next.js App Router docs/Learn course, server vs client components, caching/revalidation, Better Auth docs, Drizzle docs, Airtable Web API, Vercel deployment docs, Resend); repo-layout tour; env-var setup for local dev; gotchas (hydration, "use client", MUI SSR). Written last so it documents what actually shipped rather than the plan.

## Deferred follow-ups (explicitly out of scope)

- **Tailwind CSS v4**: not a version upgrade — the codebase has no Tailwind today; it's MUI 6 + Emotion `sx` styling across every component. Adopting Tailwind means restyling ~40 components/pages and replacing MUI primitives (buttons, drawers, dialogs, calendar), which would break the migration's core verification method (side-by-side parity with the old app) and multiply regression risk with zero test coverage. Decision: migrate styling as-is; revisit Tailwind post-cutover as its own incremental project (Tailwind v4 coexists fine with Emotion — set `@import "tailwindcss"` with preflight disabled to avoid clobbering MUI baseline styles — so it can be introduced file-by-file later without a big bang).
- **japan.geojson (12.4MB)**: TopoJSON conversion / simplification (~90% smaller) after cutover.

## Top risks

1. expandLessonItems SSR shuffle/hydration (fix designed above; test resume hard)
2. TS 4.9→5.7 minor breaks in client code (strict mode already on)
3. Next 16 + React 19 + MUI 6.4 combo — supported; do NOT bump MUI 7 now; Next 15.5 is the fallback; `params` is a Promise (await it)
4. Airtable author JSON typos — adapters fail soft, never 500
5. bcryptjs (pure JS) everywhere, never native bcrypt on Vercel
6. Neon pooled URL / neon-http driver only; no pg Pool per invocation
7. Header session flash on first paint — matches today's behavior; optional later fix by passing initial session from layout
8. Pronunciation service is a second deployable with its own host/cost — budget for an always-on container (model won't fit or stay warm on serverless); Vercel function proxy adds one hop but keeps auth/cookies uniform
9. Multipart proxy through the Next route handler — verify 10MB recordings stream through within Vercel's function payload limits (request body limit is ~4.5MB on some plans — if hit, have the client upload directly to the pronunciation service with a short-lived signed token minted by the Next route instead of proxying bytes)

## Branch strategy

All migration work happens on `feature/nextjs-vercel-migration` (created, fast-forwarded to master@68bc9b1), with commits per phase/milestone rather than one giant commit. `master` stays deployable on the current stack until Phase 6 cutover, when the branch merges in and `client/`/`server/` are deleted. **Re-merge master into the branch regularly** — lesson/content work continues on master per `.cursor/rules/always-work-on-master.mdc` (that rule applies to Cursor lesson-authoring agents; this migration branch is an explicit user-directed exception). Any master-side change under `client/src` or `server/src` between now and cutover must be re-ported — the P5 parity pass re-checks the delta.

## Key reference files

- [client/src/App.tsx](client/src/App.tsx) — routes, guards, header/footer rules the route groups replicate
- [client/src/pages/NewLessonPage.tsx](client/src/pages/NewLessonPage.tsx) — stepKey resume + shuffle constraint
- [client/src/services/api.ts](client/src/services/api.ts) — axios/token layer being deleted
- [client/src/utils/expandLessonItems.ts](client/src/utils/expandLessonItems.ts) + [termMedia.ts](client/src/utils/termMedia.ts) — port unchanged
- [server/src/models/NewLesson.ts](server/src/models/NewLesson.ts) — the schemaless items[] contract Airtable JSON must preserve
- [server/src/controllers/authController.ts](server/src/controllers/authController.ts) — bcrypt + plaintext-legacy handling the import script must honor
