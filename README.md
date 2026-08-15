# Nihon-Go!

A web app for learning Japanese — prefecture-based lessons, kana and vocabulary exercises, pronunciation scoring, and cultural content.

**Stack:** Next.js (App Router) · React 19 · TypeScript · MUI 6 · Better Auth · Postgres (Drizzle) · Airtable · deployed on Vercel.

> **Migrating from the old stack?** The app used to be Create React App + Express + MongoDB. Those still live in `client/` and `server/` until cutover. Start with **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** — it maps every old concept to its replacement.

---

## Quickstart

You need **Node 24** (pinned in `.nvmrc` and `engines`; Vercel's current default) and a **Postgres** database (local or [Neon](https://neon.tech)).

```bash
git clone https://github.com/Sachi2631/Cornerstone.git
cd Cornerstone
npm install
cp .env.example .env.local
```

Now fill in `.env.local`. The two you can't skip:

```bash
# Any Postgres URL. Local example:
DATABASE_URL=postgresql://localhost:5432/cornerstone_dev

# Required — the app refuses to boot without it:
BETTER_AUTH_SECRET=   # generate with: openssl rand -base64 32
```

Create the tables and start:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Sign up on `/auth` and you're in.

Lessons come from Airtable, so lesson pages will be empty until you add `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` (see [Environment](#environment)). Everything else — auth, profile, the map, the static pages — works without it.

<details>
<summary><b>Running Postgres locally on macOS</b></summary>

```bash
brew install postgresql@18
LC_ALL=C /opt/homebrew/opt/postgresql@18/bin/pg_ctl \
  -D /opt/homebrew/var/postgresql@18 -l /tmp/pg.log start
createdb cornerstone_dev
```

The `LC_ALL=C` is not optional — without it PostgreSQL 18 on macOS dies at startup with *"postmaster became multithreaded during startup"*.
</details>

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run parity` | Verifies every route's guard and chrome against the original app's route table |
| `npm run db:generate` | Generate a SQL migration after editing the Drizzle schema |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run payload:migrate` | Apply pending Payload migrations — always *after* `db:migrate` |
| `npm run payload:seed-admins` | Create the CMS admin accounts; idempotent, safe to re-run |

The `payload:*` commands need Node 24 and have their own rules — see
[docs/payload-content-model.md](docs/payload-content-model.md).

Data migration scripts (one-off, need `MONGODB_URI`) are covered in [CUTOVER.md](CUTOVER.md).

---

## How it fits together

```
Browser
  │
  ├── Pages ─────────── Next.js App Router (src/app)
  │                       server components fetch, client components render
  │
  ├── Auth ──────────── Better Auth → Postgres          (httpOnly cookie sessions)
  ├── Lesson content ── Airtable  (cached, 5 min)        (authors edit in Airtable)
  ├── Progress ──────── Postgres via Drizzle
  └── Pronunciation ─── Next route → container service   (wav2vec2 + ffmpeg)
```

Three things are worth knowing up front:

- **Content lives in Airtable, not the database.** Lessons are authored in the "Cornerstone Content" base. Editing a record there updates the site within seconds via a revalidation webhook.
- **Sessions are httpOnly cookies.** There is no token in `localStorage` and no `Authorization` header to attach — same-origin requests just work.
- **Pronunciation scoring runs in its own container** (`services/pronunciation/`), because the ML model can't fit in a serverless function. The app proxies to it.

---

## Repo layout

```
src/
  app/              Routes. Folders in (parens) are route groups — they set
                    layout/auth rules without appearing in the URL.
    (site)/         Header + Footer
      (public-only)/  signed-out only  → signed-in users get redirected away
      (protected)/    signed-in only   → signed-out users get sent to /auth
    (dashboard)/    Header, no Footer
    (player)/       No chrome — the lesson players
    api/            Route handlers (auth, progress, pronunciation, revalidate)
  components/       Shared UI + all exercise components
  pages-client/     Page bodies as client components
  lib/              auth, db, airtable, types, API clients
  utils/            Lesson expansion + media resolution (pure logic)
scripts/            Parity checker + one-off data migrations
services/
  pronunciation/    Standalone ML scoring container
client/  server/    The OLD CRA + Express apps. Deleted at cutover.
```

---

## Environment

Everything is documented inline in [`.env.example`](.env.example). Summary:

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | always | Neon pooled URL in production; any Postgres locally |
| `BETTER_AUTH_SECRET` | always | No fallback by design — boot fails without it |
| `BETTER_AUTH_URL` | production | Optional locally; Vercel infers from `VERCEL_URL` |
| `AIRTABLE_API_KEY` / `AIRTABLE_BASE_ID` | lesson content | Read scope is enough for the app |
| `RESEND_API_KEY` / `EMAIL_FROM` | password reset emails | Without them, dev prints the reset link to the server console |
| `REVALIDATE_SECRET` | Airtable → live updates | Shared with the Airtable automation |
| `PRONUNCIATION_SERVICE_URL` / `_SECRET` | pronunciation scoring | See `services/pronunciation/README.md` |
| `MONGODB_URI` | migration scripts only | **Never set this on Vercel** |

`.env.local` is gitignored. Never commit real secrets.

---

## Documentation

| Doc | Read it when |
|---|---|
| **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** | You're new, or you knew the old CRA/Express app |
| [CUTOVER.md](CUTOVER.md) | Running the production cutover |
| [docs/payload-content-model.md](docs/payload-content-model.md) | Working on CMS content, Payload migrations, or admin accounts |
| [MIGRATION_PLAN.md](MIGRATION_PLAN.md) | You want the decisions and their rationale |
| `services/pronunciation/README.md` | Working on pronunciation scoring |
| [App_Overview.md](App_Overview.md) | Historical — describes the pre-migration app |
