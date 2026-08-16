# AGENTS.md

Cornerstone, branded **Nihon-Go!** — a Japanese learning app: prefecture lessons, kana
and vocabulary exercises, pronunciation scoring, cultural content.

Next.js App Router · React 19 · TypeScript · MUI 6 · Better Auth · Payload CMS ·
Postgres on Neon (Drizzle + Payload) · Vercel.

## Orientation: what is live

The repo root **is** the app. `src/` is the Next project; `npm` commands run from the
root.

`client/` and `server/` are the retired CRA + Express + MongoDB app, kept only so the
cutover stays reversible, and deleted at [CUTOVER.md](docs/CUTOVER.md) step 10 (#42,
still open). Nothing in them runs, and nothing new should be added to them. When a
request names a file, check which side of that line it falls on before editing — the
two trees contain same-named components that are not interchangeable.

**Which docs are current, and which are history.** Every historical document opens with
a status banner saying what in it is superseded — if a file has one, read it before the
body.

Current, and safe to follow:

- [README.md](README.md) and this file — the orientation
- [MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) — the developer guide. Despite the name it
  was written after the pivot and describes the running stack; only its old→new
  mapping sections are historical
- [docs/database-workflow.md](docs/database-workflow.md),
  [docs/payload-content-model.md](docs/payload-content-model.md),
  `services/pronunciation/README.md`

History — read for the record, not as instruction:

- [MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) — the original plan. Its Airtable and
  user-migration sections were reversed and are flagged inline
- [App_Overview.md](docs/App_Overview.md) — the pre-migration MERN app
- [MIGRATION_EVALUATION.md](docs/MIGRATION_EVALUATION.md) — a pre-decision evaluation,
  resolved against its own tentative recommendation
- [CUTOVER.md](docs/CUTOVER.md) — the runbook. Mostly executed, but **partly live**:
  step 10 (decommission) and its rollback notes are still instruction. Its banner says
  which

Airtable was a mid-migration content backend and is gone: no dependency, no
`/api/revalidate` route, no live `AIRTABLE_*` or `REVALIDATE_SECRET` anywhere (the names
survive in `.env.example` only in a comment telling you to delete them), and the only
mentions left in `src/` are historical comments. Content comes from Payload.

## Commands

`package.json` is the list. Four things it does not tell you:

- **Migration order is fixed**: `npm run db:migrate` before `npm run payload:migrate`.
  Payload never issues `CREATE SCHEMA`, so Drizzle has to create `payload` first.
- **There is no test suite.** A change is verified by `npm run typecheck` plus
  `npm run parity [url]`, which checks all 36 routes in both auth states and then
  asserts the CMS is up and serving real content. Both must pass before you call
  something done.
- **Node 24**, pinned in `.nvmrc` and `engines`.
- `npm run dev` rewrites the managed block at the bottom of this file. Leave it alone
  and the tree stays clean.

## Architecture

### One database, two schemas, two migration systems

Drizzle owns `public` (Better Auth tables + `user_progress`); Payload owns `payload`
(all content). They share one Neon database, joined by a cross-schema foreign key from
`public.user_progress` to `payload.lessons(slug)` — a natural key, not an id.

Payload runs with `push: false` in every environment including dev. One boot with
`push: true` writes a row that makes every later `payload migrate` block on an
interactive prompt, which in CI simply hangs. Schema changes go through
`npm run payload:migrate:create`.

→ [docs/database-workflow.md](docs/database-workflow.md) for Neon branches and the PR
flow; [docs/payload-content-model.md](docs/payload-content-model.md) for the collection
shapes and the Payload tooling's own rules.

### Content is read through exactly one module

`src/lib/content/content.ts` is the only place the app reads content. It calls
Payload's **local API** — an in-process query, not HTTP — so there is no `fetch` for
Next to cache, and caching is explicit: each lookup is wrapped in `unstable_cache`,
tagged, and invalidated by the collection hooks in `src/payload/hooks/revalidate.ts`
the moment an editor saves. A one-hour expiry is the backstop for a missed hook.

Reads pass `overrideAccess: false`, so an unpublished draft cannot leak even if a
query forgets to filter. Keep new reads inside this module and inside that rule.

### Two players, one collection

Lessons used to be two parallel systems. They are now one `lessons` collection with a
`format` field that decides which player renders a document:

- `flashcard` → `/lesson/<slug>` — the prefecture player
- `step` → `/newlesson/<slug>` — the grammar player, one component per screen

When a request says "lesson", establish which format it means before picking files.
Exercise components are likewise format-specific and not 1:1 interchangeable.

### Auth: cookie sessions, enforced server-side

Better Auth issues httpOnly cookie sessions — no token in `localStorage`, no
`Authorization` header to attach. `src/proxy.ts` is an optimistic gate: it checks only
that a cookie *exists*, because validating means a database call. The real boundary is
`requireSession()` from `src/lib/session.ts`, called in the `(protected)`,
`(dashboard)` and `(player)` layouts and in route handlers.

`proxy.ts` is Next 16's name for what used to be `middleware.ts` — same position, same
runtime, same `config.matcher`, exported function named `proxy`. Write new code against
that name.

Route groups carry both the auth rule and the chrome: `(site)` has Header + Footer,
`(dashboard)` drops the Footer, `(player)` has none. A new page inherits its group's
rules — put it in the right group rather than re-implementing the gate.

### Payload admin

Mounted at `/admin`, authenticated by the `cms_admins` collection — editors, entirely
separate from learner accounts in `public.user`.

While zero `cms_admins` rows exist, Payload serves an **unauthenticated first-user
form** to anyone who finds the URL (#32). `npm run payload:seed-admins` closes that
window and is idempotent. The state is readable at `/api/cms_admins/init`; it cannot
be read off the admin HTML, since the bootstrap and login screens are indistinguishable
over HTTP.

### Pronunciation runs elsewhere

`services/pronunciation/` is a standalone container (wav2vec2 + ffmpeg) because the
model does not fit in a serverless function. `POST /api/pronunciation/check` proxies to
it over a shared secret. Scoring changes belong in that service, not in `src/`.

## Working agreements

- **Issues** live in GitHub (`Sachi2631/Cornerstone`) via `gh` —
  [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).
- **Domain docs** — `CONTEXT.md` and `docs/adr/`, created lazily by `/domain-modeling`.
  See [docs/agents/domain.md](docs/agents/domain.md).
- This is an old first project carrying real content alongside accumulated dead code.
  Confirm a thing is wired up before treating its existence as intent.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
