---
name: onboard-dev
description: Use when someone is setting up this repo for the first time, has a fresh clone that will not run, or asks how to get a local dev environment working — covers Node, .env.local, the Neon database branch, both migration systems, and verifying the environment actually works.
---

# Onboarding a developer onto Cornerstone

Walk one human through a working local environment, stopping at every point
where only they can supply an answer.

**Core principle: you run the commands, they make the decisions.** Installing
packages, applying migrations and running checks are yours. Choosing a database
branch, fetching a connection string out of a console, and deciding whether to
seed content are theirs. Never guess a value they have not given you.

## Checkpoint discipline

Every stage below ends at a **CHECKPOINT**. At one you MUST stop, report what
you found, ask the stage's question, and wait for a reply.

Do not batch stages. Do not ask a question and start the next command in the
same message. The person being onboarded is learning the system as you go — a
wall of six completed stages teaches them nothing and hides which step broke.

| Rationalization | Reality |
|---|---|
| "They obviously want the default, I'll assume it" | The branch choice in stage 2 determines whether their migrations land on a shared database everyone else is using. Ask. |
| "I'll run the migrations now and tell them after" | Migrations are the one irreversible step here. Confirm first, every time. |
| "They said 'set it all up', that's blanket approval" | It authorizes the sequence, not the individual values. Values still get confirmed. |
| "The checkpoint is a formality, I'll note it and continue" | A checkpoint you narrate past is not a checkpoint. Stop and wait for a reply. |
| "Stage 4 is optional, I'll just skip it silently" | Offer it and let them decline. Skipping silently means they never learn `/admin` exists. |

**Never write a value into `.env.local` before showing them what it is and what
it does.** `.env.local` is gitignored, but it is still their file.

## Before you start

Read [README.md](../../../README.md) and [AGENTS.md](../../../AGENTS.md) if you
have not this session. Say roughly this, then begin stage 0:

> I'll get you a working local environment in six stages: preflight, env file,
> database, migrations, optional extras, then verification. I'll run the
> commands; I'll stop and ask whenever something needs your input or is about to
> change a database. Should take 15–20 minutes, most of it waiting on `npm
> install` and migrations.

---

## Stage 0 — Preflight

```bash
node -v && npm -v && git rev-parse --show-toplevel && cat .nvmrc
```

**Node must match `.nvmrc` (24).** `package.json` currently declares
`engines.node: ">=22.23.1"`, which is looser and disagrees with both `.nvmrc`
and the docs — treat `.nvmrc` as authoritative and do not "fix" `package.json`
as part of onboarding. On the wrong major, the tell is usually Payload:
migration files fail to load under Node 24's type stripping rules, and older
Node fails elsewhere.

If Node is wrong, offer the fix for their version manager rather than picking
one: `nvm use` (reads `.nvmrc`), `fnm use`, `mise use node@24`, or `asdf install`.

Then check the optional tooling and report what is missing:

| Tool | Needed for | If absent |
|---|---|---|
| `neonctl` | `db:branch:*` scripts | They can copy connection strings from the Neon console instead. `npm i -g neonctl`, then `neonctl auth` once |
| `gh` | Issues, PRs | Not needed to run the app |
| `psql` | Poking at the database by hand | Optional |

Install dependencies:

```bash
npm install
```

**CHECKPOINT 0.** Report the Node version, whether it matches, and which
optional tools are missing. Ask whether to continue.

---

## Stage 1 — `.env.local`

```bash
cp .env.example .env.local
```

If `.env.local` already exists, **do not overwrite it** — read it, report which
required keys are already filled, and work with what is there.

`.env.example` documents every variable inline; read it rather than restating
it. What a new developer actually needs to know is where each value comes from:

| Variable | Required? | Where it comes from |
|---|---|---|
| `DATABASE_URL` | **Yes** | Neon console, or `npm run db:branch:url -- <branch>`. Stage 2. Must be the **pooled** string — the host contains `-pooler` |
| `BETTER_AUTH_SECRET` | **Yes** | Generate locally: `openssl rand -base64 32`. No fallback exists; the app refuses to boot without it |
| `PAYLOAD_SECRET` | **Yes** | Generate locally: `openssl rand -base64 32`. Without it `/admin` and every Payload API route return "There was an error initializing Payload" |
| `BETTER_AUTH_URL` | No | `http://localhost:3000` locally. Production only on Vercel — pinned on a preview it 403s its own sign-in |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel sets it when Blob storage is added. Empty locally falls back to the filesystem |
| `RESEND_API_KEY` / `EMAIL_FROM` | No | Leave blank in dev — password-reset links print to the server console instead of being emailed. That is expected behaviour, not a failure |
| `PRONUNCIATION_SERVICE_URL` / `_SECRET` | No | Only if working on pronunciation scoring — see `services/pronunciation/README.md`. Skip for a normal setup |
| `MONGODB_URI` | No | One-off migration scripts only. **Never set on Vercel** |

`AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` and `REVALIDATE_SECRET` are dead. If
they appear in an `.env.local` carried over from somewhere, delete them.

Generate the two secrets and show them the values before writing:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # PAYLOAD_SECRET
```

These are local development secrets with no counterpart anywhere else — they
are yours to generate. Everything else in the table above is theirs to supply.

**CHECKPOINT 1.** Show both generated values and confirm before writing them
into `.env.local`. Note that `DATABASE_URL` is still the placeholder from
`.env.example` and comes next.

---

## Stage 2 — The database branch

**There is no local Postgres.** Every developer runs against a Neon branch, so
local schema behaviour matches production exactly. Full detail in
[docs/database-workflow.md](../../../docs/database-workflow.md).

Explain the choice before asking, because it has a consequence they cannot
undo later in the session:

- **`development`** — the shared branch. Fine to start on. But a migration you
  apply here lands on everyone else's app too, usually mid-task.
- **`dev/<their-name>`** — their own long-lived branch, forked from
  `production`. Right choice if they expect to touch the schema at all.

**CHECKPOINT 2a.** Ask which one. Do not pick for them.

For their own branch:

```bash
npm run db:branch:new -- dev/<name>
npm run db:branch:url -- dev/<name>
```

For the shared branch:

```bash
npm run db:branch:url -- development
```

Without `neonctl`, they pull the pooled string from the Neon console
(project `cornerstone`, `bold-bar-07861256`) under that branch.

**CHECKPOINT 2b.** Ask them to paste the connection string. Then validate it
before writing anything, and refuse to proceed on either of these:

- **Host does not contain `-pooler`** — that is the direct endpoint. The app
  wants the pooled one.
- **It resolves to `production`** — never point `.env.local` at production. A
  sign-up would create a real user row. Compare against
  `neonctl connection-string production --project-id bold-bar-07861256`;
  two branches of one project differ only in the endpoint id at the front of
  the host, so compare hosts rather than eyeballing the whole string.

Write it to `.env.local` as `DATABASE_URL` only once both checks pass.

---

## Stage 3 — Migrations

**The order is fixed and not a style preference.** drizzle-kit owns the
`public` schema (Better Auth tables, `user_progress`) *and* issues
`CREATE SCHEMA payload`. Payload owns everything inside `payload` and never
creates the schema itself. Run them backwards against a fresh branch and it
fails with `schema "payload" does not exist`.

Tell them what is about to be changed and on which branch:

**CHECKPOINT 3.** State the branch name and that both migration systems are
about to run against it. Wait for confirmation.

```bash
npm run db:migrate
npm run payload:migrate
```

Never run `drizzle-kit push` against any branch carrying the cross-schema
foreign key — it diffs against the live database and can propose dropping a
constraint that is not in `schema.ts`.

If `payload:migrate` blocks on an interactive prompt, the branch was booted
once with `push: true`. Reset it (`npm run db:branch:reset -- <name>`) and
re-run both, rather than answering the prompt.

---

## Stage 4 — Optional extras

Offer each, take their answer, do not assume.

**CMS admin account.** Until at least one `cms_admins` row exists, Payload
serves an *unauthenticated first-user form* at `/admin` to anyone who reaches
it. Closing that window is one idempotent command:

```bash
npm run payload:seed-admins
```

**Lesson content.** A branch forked from `production` already has content. A
freshly migrated one is empty, which shows up as lesson pages that render but
are blank — that is an empty database, not a broken build. Importing content
needs `MONGODB_URI` and is covered in [CUTOVER.md](../../../docs/CUTOVER.md)
step 7; for most onboarding, branching from a parent that already has content
is the better answer.

**Pronunciation service.** Out of scope for a standard setup. Scoring requests
will fail without it, and everything else works. Point at
`services/pronunciation/README.md` if they want it — first boot downloads
~300MB of model weights.

**CHECKPOINT 4.** Confirm which extras they want; run only those.

---

## Stage 5 — Verification

Do not declare the environment working on the basis that the dev server
started. Run the whole list and report each line as pass or fail.

Start the dev server first (use the `next-dev` config in `.claude/launch.json`
if you have preview tooling; otherwise `npm run dev`), then:

| # | Check | Command / method | Pass looks like |
|---|---|---|---|
| 1 | Node matches | `node -v` vs `.nvmrc` | `v24.x` |
| 2 | Required env keys set | Read `.env.local` | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PAYLOAD_SECRET` all non-empty |
| 3 | Pointing at the right branch | Host in `DATABASE_URL` | Contains `-pooler`, is **not** production |
| 4 | Types compile | `npm run typecheck` | Exit 0, no output |
| 5 | Payload migrations current | `npm run payload:migrate:status` | No pending migrations |
| 6 | Server answers | `curl -sS -o /dev/null -w '%{http_code}' http://localhost:3000/` | `200` |
| 7 | Auth page renders | Load `/auth` | Sign-in form, no error overlay |
| 8 | Auth round-trips | Sign up with a throwaway email, then reload | Lands signed in; session survives the reload |
| 9 | Admin bootstrap closed | `curl -sS http://localhost:3000/api/cms_admins/init` | Reports an admin exists — *only if* stage 4 seeding was run |
| 10 | Full route parity | `npm run parity` | All 36 routes pass in both auth states, CMS serving real content |

Check 10 is the one that matters most. **This repo has no test suite** —
`npm run typecheck` plus `npm run parity` is what "verified" means here, and
both must pass before anyone calls a change done. Worth saying out loud during
onboarding, since it is the single most surprising thing about the project.

`npm run parity` takes a URL argument and defaults to localhost. Against a
Vercel *preview* URL it additionally needs `VERCEL_AUTOMATION_BYPASS_SECRET`,
or it measures the Vercel auth wall instead of the app. Localhost needs nothing.

**CHECKPOINT 5.** Report the table with each line marked. If anything failed,
work the troubleshooting table below rather than moving on.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `schema "payload" does not exist` | `payload:migrate` ran before `db:migrate` | Run `npm run db:migrate` first, then `npm run payload:migrate` |
| "There was an error initializing Payload" on `/admin` or any `/api/*` Payload route | `PAYLOAD_SECRET` empty | Set it in `.env.local`, restart the dev server |
| App refuses to boot at all | `BETTER_AUTH_SECRET` empty | Set it. There is no fallback, by design |
| `/admin` shows a create-first-user form to anyone | Zero `cms_admins` rows | `npm run payload:seed-admins` |
| Lesson pages render but are empty | Branch has schema but no content | Expected on a fresh fork from an empty parent. Fork from a parent with content, or import per CUTOVER step 7 |
| First request after a break takes 1–2s | Neon branch scaled to zero after ~5 min idle | Not your code. It wakes on the next query |
| `payload:migrate` hangs on a prompt | Branch was booted once with `push: true` | Reset the branch and re-run both migration systems |
| `403 INVALID_ORIGIN` on sign-in | `BETTER_AUTH_URL` pinned to a different origin | Locally leave it at `http://localhost:3000` or unset |
| Content vanished after `vercel env pull` | It overwrote `.env.local` with a Development-scoped `DATABASE_URL` pointing at an unmigrated branch | Restore `DATABASE_URL` by hand. Nothing here runs through Vercel locally |
| `npm run parity` fails on a preview URL, everything else fine | Missing `VERCEL_AUTOMATION_BYPASS_SECRET` | Add it, or run parity against localhost |

---

## Wrap-up

Once the checks pass, hand them the map rather than a wall of links:

| Read | When |
|---|---|
| [README.md](../../../README.md) | Commands and how the pieces fit |
| [docs/MIGRATION_GUIDE.md](../../../docs/MIGRATION_GUIDE.md) | The developer guide. Despite the name it describes the *running* stack |
| [docs/database-workflow.md](../../../docs/database-workflow.md) | Before touching the schema |
| [docs/payload-content-model.md](../../../docs/payload-content-model.md) | Before touching CMS content |
| [AGENTS.md](../../../AGENTS.md) | Same orientation, condensed |

Four things worth saying rather than linking, because they catch people out:

- Migrate Drizzle before Payload, always.
- No test suite — `typecheck` + `parity` is the bar.
- Content lives in Payload in the same database, edited at `/admin`.
- Historical docs (`CUTOVER.md`, `MIGRATION_PLAN.md`, `App_Overview.md`) open
  with a banner saying what in them is superseded. Read the banner first; some
  step text still reads in the pending tense for work that is long done.
