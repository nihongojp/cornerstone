# Nihon-Go!

A web app for learning Japanese — prefecture-based lessons, kana and vocabulary exercises, pronunciation scoring, and cultural content.

**Stack:** Next.js (App Router) · React 19 · TypeScript · MUI 6 · Better Auth · Payload CMS · Postgres on Neon (Drizzle + Payload) · deployed on Vercel.

> **Knew the old stack?** The app used to be Create React App + Express + MongoDB, in `client/` and `server/`. Both were removed at [cutover](docs/CUTOVER.md) step 10 (#42) — this repo is now one application. [MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) maps the old concepts to their replacements; the deleted code is in git history if you need it.

---

## Quickstart

> **Setting up for the first time?** If you use Claude Code, run `/onboard-dev`
> — it walks the whole setup interactively, stopping to ask wherever a value is
> yours to supply, and finishes by verifying the environment actually works. The
> manual steps are below either way.

You need **Node 24 LTS** (`.nvmrc` says `24`; `engines` floors it at 24.11.0, where the line went LTS) and a database branch.

```bash
git clone https://github.com/nihongojp/cornerstone.git
cd cornerstone
npm install
cp .env.example .env.local
```

**There is no local Postgres.** Every developer works against a Neon branch, so local schema behaviour matches production's exactly — see [docs/database-workflow.md](docs/database-workflow.md). Point `DATABASE_URL` at the shared `development` branch (never at `production`); its connection string is in the Neon console, or:

```bash
npm run db:branch:url development
```

Then fill in the three secrets you can't skip:

```bash
DATABASE_URL=          # pooled URL for the development branch
BETTER_AUTH_SECRET=    # openssl rand -base64 32 — the app refuses to boot without it
PAYLOAD_SECRET=        # openssl rand -base64 32 — the CMS admin 500s without it
```

Create the tables and start. **The order matters**: Payload never issues `CREATE SCHEMA`, so Drizzle has to go first.

```bash
npm run db:migrate       # public schema — auth tables, user_progress, and CREATE SCHEMA payload
npm run payload:migrate   # the payload schema — all content
npm run dev
```

Open http://localhost:3000. Sign up on `/auth` and you're in.

Content comes from Payload in the same database, so a freshly migrated branch has empty lesson pages until content is imported ([CUTOVER.md](docs/CUTOVER.md) step 7) — branching from `development` instead gets you a copy that already has it. To sign in to `/admin`, run `npm run payload:seed-admins` first; until at least one admin exists, Payload serves an unauthenticated first-user form there.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run parity [url]` | Verifies every route's guard and chrome against the original app's route table, then that the CMS is up and serving real content |

Against a Vercel **preview** or `*.vercel.app` URL, `npm run parity` needs `VERCEL_AUTOMATION_BYPASS_SECRET` in `.env.local` or the environment — those URLs sit behind Vercel Authentication, and without it the run measures the auth wall instead of the app. Localhost and the custom production domain need nothing.
| `npm run db:generate` | Generate a SQL migration after editing the Drizzle schema |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run payload:migrate` | Apply pending Payload migrations — always *after* `db:migrate` |
| `npm run payload:seed-admins` | Create the CMS admin accounts; idempotent, safe to re-run |

The `payload:*` commands need Node 24 and have their own rules — see
[docs/payload-content-model.md](docs/payload-content-model.md).

Data migration scripts (one-off, need `MONGODB_URI`) are covered in [CUTOVER.md](docs/CUTOVER.md).

---

## How it fits together

```
Browser
  │
  ├── Pages ─────────── Next.js App Router (src/app)
  │                       server components fetch, client components render
  │
  ├── Auth ──────────── Better Auth → Postgres  public   (httpOnly cookie sessions)
  ├── Lesson content ── Payload CMS  → Postgres payload  (authors edit at /admin)
  ├── Progress ──────── Drizzle      → Postgres public
  └── Pronunciation ─── Next route → container service   (wav2vec2 + ffmpeg)
```

Four things are worth knowing up front:

- **One database, two schemas, two migration systems.** Drizzle owns `public` (auth tables, `user_progress`); Payload owns `payload` (all content). A cross-schema foreign key ties `user_progress` to `lessons(slug)`. Always migrate Drizzle first.
- **Content lives in Payload, in that same database.** Lessons are authored at `/admin`. There is no external CMS, no webhook and no shared secret: the collection hooks in `src/payload/hooks/revalidate.ts` drop the affected cache tags in-process on every save, because Payload runs inside the app. A one-hour expiry covers anything a hook misses.
- **Sessions are httpOnly cookies.** There is no token in `localStorage` and no `Authorization` header to attach — same-origin requests just work. `src/proxy.ts` (Next 16's name for middleware) only checks that a cookie exists; the real boundary is `requireSession()` in the route-group layouts.
- **Pronunciation scoring runs in its own container** (`services/pronunciation/`), because the ML model can't fit in a serverless function. The app proxies to it.

---

## Repo layout

```
src/
  app/
    (app)/          The site itself. Folders in (parens) are route groups —
                    they set layout/auth rules without appearing in the URL.
      (site)/         Header + Footer
        (public-only)/  signed-out only  → signed-in users get redirected away
        (protected)/    signed-in only   → signed-out users get sent to /auth
      (dashboard)/    Header, no Footer
      (player)/       No chrome — the two lesson players
      api/            Route handlers (auth, progress, pronunciation)
    (payload)/      The CMS admin at /admin and Payload's REST/GraphQL API.
                    Generated by Payload — don't hand-edit.
  components/       Shared UI + all exercise components
  pages-client/     Page bodies as client components
  lib/
    content/        The content API — the only module that reads from Payload
    db/             Drizzle schema + connection
    auth.ts         Better Auth config; session.ts is the page-level guard
  payload/          Collections, blocks, hooks, and Payload's migrations
  utils/            Lesson expansion + media resolution (pure logic)
  payload.config.ts
drizzle/            Migrations for the public schema
scripts/            Parity checker, Payload tooling, one-off data migrations
services/
  pronunciation/    Standalone ML scoring container
```

---

## Environment

Everything is documented inline in [`.env.example`](.env.example). Summary:

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | always | Pooled Neon URL. The driver switches on the host, so any Postgres URL works. On Vercel set it for Production only — Preview's is injected per deployment by the Neon integration |
| `BETTER_AUTH_SECRET` | always | No fallback by design — boot fails without it |
| `PAYLOAD_SECRET` | the CMS | `/admin` and Payload's REST API 500 without it. Rotating it drops every admin session |
| `BETTER_AUTH_URL` | production | The public origin — `https://learn.nihongojp.com` — and the fallback when a request's host matches no allowed host. Previews no longer depend on leaving it unset: `src/lib/auth.ts` builds `baseURL: { allowedHosts }` instead (#55) |
| `VERCEL_PREVIEW_PROJECT_NAME` | Google/auth on Preview | The Vercel **project** name, used to trust `<project>-*.vercel.app`. Cannot be derived — with a custom domain attached, `VERCEL_PROJECT_PRODUCTION_URL` holds that domain, not the project. Unset means previews are not trusted and sign-in 403s there |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in | Redirect URI is `{origin}/api/auth/callback/google`, matched by Google as an exact string. Boot fails without them outside development |
| `BLOB_READ_WRITE_TOKEN` | CMS media | Set for you when Blob storage is added to the Vercel project. The store must be **private** — media is served through Payload's auth-gated route, so signed-out requests 403. Empty locally falls back to the filesystem |
| `PREVIEW_SECRET` | CMS live preview | Fails closed: unset, `/api/preview` 403s everything and the admin hides Live Preview. Not the boundary on its own — the route also checks the caller's `cms_admins` session |
| `NEXT_PUBLIC_SERVER_URL` | CMS live preview | The exact origin `/admin` is served from. Set it per environment, Preview included. Falls back to `http://localhost:3000`, which is wrong on any deploy |
| `RESEND_API_KEY` / `EMAIL_FROM` | **all sign-in** | Sign-in links, one-time codes and confirmations all go through Resend, so mail delivery *is* the login system. Production sends as `noreply@send.nihongojp.com` — a `send.` subdomain, so sending reputation is isolated from the root domain |
| `SUPPORT_EMAIL` | all environments | Sets `Reply-To` — `support@nihongojp.com`. `EMAIL_FROM` cannot receive, so without this a user locked out by a spam filter who replies to their sign-in mail reaches nobody, the exact failure #47 names. Safe to set before the mailbox exists: replies bounce either way today, and it starts working when MX records are added. Receiving on the root domain is independent of sending from `send.` |
| `AUTH_DEV_LOG_LINKS` | local only | `1` prints sign-in links and codes to the server console instead of sending. Those lines are working credentials — without it a missing mail config is an error, and a production build refuses the flag outright |
| `RATE_LIMIT_IN_DEV` | local only | Better Auth rate-limits on production only, so a broken limiter is invisible in dev. `1` turns it on to check it writes to `rate_limit` |
| `PRONUNCIATION_SERVICE_URL` / `_SECRET` | pronunciation scoring | See `services/pronunciation/README.md` |
| `MONGODB_URI` | migration scripts only | **Never set this on Vercel** |

`AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` and `REVALIDATE_SECRET` are gone — delete them from any `.env.local` or Vercel environment that still has them.

`.env.local` is gitignored. Never commit real secrets.

---

## Documentation

Everything lives in [`docs/`](docs/) except this file and [AGENTS.md](AGENTS.md).

**Current — these describe the running app:**

| Doc | Read it when |
|---|---|
| [database-workflow.md](docs/database-workflow.md) | Touching the schema, or setting up your branch |
| [payload-content-model.md](docs/payload-content-model.md) | Working on CMS content, Payload migrations, or admin accounts |
| [MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) | The developer guide — how each subsystem works, common tasks, gotchas. Also maps old→new if you knew the CRA/Express app |
| [AGENTS.md](AGENTS.md) | You're a coding agent, or want the same orientation in brief |
| `services/pronunciation/README.md` | Working on pronunciation scoring |

**Historical — kept as the record, not as instruction.** Each opens with a banner saying what in it is superseded:

| Doc | What it is |
|---|---|
| [MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) | The original plan: decisions and rationale. Its Airtable and user-migration sections were reversed |
| [CUTOVER.md](docs/CUTOVER.md) | The runbook for how production was built. The cutover has happened; only step 10 (decommission) and the rollback notes are still live |
| [DECOMMISSION.md](docs/DECOMMISSION.md) | What was retired at cutover, the final mongodump, and the date the 30-day MongoDB window ends |
| [App_Overview.md](docs/App_Overview.md) | The pre-migration MERN app. Useful only for its feature/content inventory |
| [MIGRATION_EVALUATION.md](docs/MIGRATION_EVALUATION.md) | A pre-decision Vite-vs-Next evaluation, resolved against its own tentative recommendation |
