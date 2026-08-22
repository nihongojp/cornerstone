# AGENTS.md

Cornerstone, branded **Nihon-Go!** — a Japanese learning app: prefecture lessons, kana
and vocabulary exercises, pronunciation scoring, cultural content.

Next.js App Router · React 19 · TypeScript · MUI 6 · Better Auth · Payload CMS ·
Postgres on Neon (Drizzle + Payload) · Vercel.

## Orientation: what is live

The repo root **is** the app. `src/` is the Next project; `npm` commands run from the
root.

**Deployed, but pre-launch.** Production serves at `learn.nihongojp.com` and the cutover
is done — but there are **no users yet**. Several docs here, [CUTOVER.md](docs/CUTOVER.md)
above all, describe production in a tone that reads as settled and risky to disturb. Take
the deployment as real and the caution as premature: there is no user data to protect and
no migration cost to changing course. See the last bullet under
[Working agreements](#working-agreements).

**There is only one application here now.** The retired CRA + Express + MongoDB app
that used to sit in `client/` and `server/` was removed at
[CUTOVER.md](docs/CUTOVER.md) step 10 (#42), once the final `mongodump` was taken. If
you are looking for a component that a comment or an old doc says lives under
`client/src/`, it is in git history — not the working tree, and not somewhere to be
restored to without a reason. Provenance comments across `src/` still name those old
paths deliberately; they record where a file came from.

**Which docs are current, and which are history.** Every historical document opens with
a status banner saying what in it is superseded — if a file has one, read it before the
body.

Current, and safe to follow:

- [README.md](README.md) and this file — the orientation
- [MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) — the developer guide. Despite the name it
  was written after the pivot and describes the running stack; only its old→new
  mapping sections are historical
- [database-workflow.md](docs/database-workflow.md),
  [payload-content-model.md](docs/payload-content-model.md),
  `services/pronunciation/README.md`
- [DECOMMISSION.md](docs/DECOMMISSION.md) — what the cutover retired, where the final
  `mongodump` lives, and the date the 30-day MongoDB window ends (2026-09-15)

History — read for the record, not as instruction:

- [MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) — the original plan. Its Airtable and
  user-migration sections were reversed and are flagged inline
- [App_Overview.md](docs/App_Overview.md) — the pre-migration MERN app
- [MIGRATION_EVALUATION.md](docs/MIGRATION_EVALUATION.md) — a pre-decision evaluation,
  resolved against its own tentative recommendation
- [CUTOVER.md](docs/CUTOVER.md) — the runbook, now fully executed including step 10
  (#42). Its rollback notes remain useful reference; the step bodies are history. Read
  its banner before the body — some step text still reads in the pending tense. Note the
  banner's warnings are written for a production with users; there are none yet

Airtable was a mid-migration content backend and is gone: no dependency, no
`/api/revalidate` route, no live `AIRTABLE_*` or `REVALIDATE_SECRET` anywhere (the names
survive in `.env.example` only in a comment telling you to delete them), and the only
mentions left in `src/` are historical comments. Content comes from Payload.

## Commands

`package.json` is the list. Four things it does not tell you:

- **Migration order is fixed**: `npm run db:migrate` before `npm run payload:migrate`.
  Payload never issues `CREATE SCHEMA`, so Drizzle has to create `payload` first.
- **There is no test suite.** A change is verified by `npm run typecheck` plus
  `npm run parity [url]`, which checks all 40 routes in both auth states and then
  asserts the CMS is up and serving real content. Both must pass before you call
  something done.
- **Node 24 LTS**, pinned in `.nvmrc` and floored at 24.11.0 in `engines`. CI
  reads `.nvmrc` via `node-version-file`, so that file is the one to change.
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

That rule only became true once the collections' own `read` access enforced it.
The three content collections share `readPublishedOrEditor`
(`src/payload/access/readPublished.ts`): a signed-in CMS user reads everything,
everyone else is constrained to `_status: published`. They previously declared
`read: () => true`, which is not "public read" but *no filter at all* — and
Payload's REST API is mounted publicly, so `GET /api/lessons` served unpublished
documents to anyone, with or without `?draft=true`. Never write
`read: () => true` on a collection that has drafts enabled.

The draft readers at the bottom of that file (`getDraftLesson`,
`getDraftNextSlug`, `getDraftResources`) are the one exception to the published
filter, and they stay inside the rule: they are uncached, they only run for a
request in Draft Mode, and they pass the authenticated `cms_admins` editor as
`user` rather than switching `overrideAccess` off. They exist for the CMS
preview panel — see `docs/payload-content-model.md`.

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
`requireSession()` from `src/lib/session.ts`, called in the `(learn)` and
`(dashboard)` layouts, `requirePlayerAccess()` in the `(player)` layout, and in
route handlers.

`proxy.ts` is Next 16's name for what used to be `middleware.ts` — same position, same
runtime, same `config.matcher`, exported function named `proxy`. Write new code against
that name.

Route groups carry both the auth rule and the chrome: `(public)` has Header + Footer,
`(learn)` adds `requireSession()`, `(dashboard)` drops the Footer, `(player)` has none.
A new page inherits its group's rules — put it in the right group rather than
re-implementing the gate. `(player)` stays a sibling of `(learn)` so a CMS editor
can preview without a learner session.

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

- **Issues** live in GitHub (`nihongojp/cornerstone`) via `gh` —
  [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md). The old
  `Sachi2631/Cornerstone` name still resolves by redirect; don't write it in new code
  or docs.
- **Domain docs** — `CONTEXT.md` and `docs/adr/`, created lazily by `/domain-modeling`.
  See [docs/agents/domain.md](docs/agents/domain.md).
- This is an old first project carrying real content alongside accumulated dead code.
  Confirm a thing is wired up before treating its existence as intent.
- **Pre-launch: the current shape is not a constraint.** The app is deployed, but there
  are no users yet. So the point above cuts both ways — an existing arrangement is
  evidence of how the code got here, not a decision someone made and not a reason to
  preserve it. When a fix has a cheap-but-wrong option and a correct-but-larger one,
  propose the correct one; changing fields, schemas and dependencies is in bounds. Weigh
  "would we build it this way today?" above "what changes least?". This stops applying at
  launch — once real users exist, re-confirm before assuming it still holds.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
