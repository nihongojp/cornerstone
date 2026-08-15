# Database workflow (Neon)

One Neon project, `cornerstone` (`bold-bar-07861256`). Two long-lived branches
plus short-lived ones per pull request.

| branch | role | who writes to it |
|---|---|---|
| `production` (default) | what the deployed app uses | **only** the migrate-production workflow |
| `development` | shared local-dev database | developers, via `.env.local` |
| `preview/pr-<n>` | one per PR, auto-created and auto-deleted | CI |
| `ticket-*`, `spike-*` | throwaway, created by hand with an expiry | whoever made it |

**Never point `.env.local` at `production`.** Local development uses
`development`; the connection string is in the Neon console under that branch.

## Why branches instead of a local Postgres

A Neon branch is a copy-on-write fork of the parent, so a dev or preview branch
starts with production's exact schema — and, if the parent has data, its data —
without a dump/restore. That makes "does this migration apply cleanly to what
production actually looks like?" a question CI can answer on every PR.

## The two migration systems, and their order

This repo has two, deliberately (see `docs/spikes/payload-schema-coexistence.md`):

1. **drizzle-kit** owns the `public` schema (`user`, `session`, `account`,
   `verification`, `user_progress`) and also creates the `payload` schema.
2. **Payload** owns everything inside the `payload` schema.

Always run them in that order — `npm run db:migrate` then
`npm run payload:migrate`. A fresh database fails the other way round with
`schema "payload" does not exist`.

The cross-schema foreign key from `public.user_progress` to `payload.lessons`
is therefore a **Payload** migration, not a drizzle one, even though it alters
a `public` table: Payload runs second, so that is the first moment both sides
of it exist. Putting it in drizzle made a fresh database unmigratable (#44) —
drizzle applies its whole pending set in one transaction, so the failing FK
took `CREATE SCHEMA payload` down with it and `db:migrate` exited 1 against an
empty database, printing nothing.

Never run `drizzle-kit push` against any branch that has the cross-schema
foreign key: it diffs against the live database and can propose dropping a
constraint that is not in `schema.ts`.

## Pull requests

`.github/workflows/neon-preview-branch.yml` creates `preview/pr-<n>` from
`production` when a PR opens, runs both migration systems against it, then
typechecks and builds. The branch is deleted when the PR closes. A migration
that fails to apply therefore fails the PR, not the merge.

## Merging

`.github/workflows/migrate-production.yml` runs on push to `master`/`main` when
anything under `drizzle/`, `src/payload/migrations/`, `src/lib/db/schema.ts`, or
`src/payload.config.ts` changes. It checks that Payload's generated migration
files are `import type`-safe (they fail to load under Node 24's default type
stripping otherwise), prints pending migrations, then applies both systems.

It targets the `production` GitHub Environment, so adding required reviewers
there turns every production migration into an explicit human approval.
Migrations are **not** run from Vercel's build: a build can run more than once
per deploy and also runs for previews.

## One-time setup

Not yet done — these are required before either workflow does anything:

| kind | name | value |
|---|---|---|
| secret | `NEON_API_KEY` | Neon console → Account settings → API keys |
| variable | `NEON_PROJECT_ID` | `bold-bar-07861256` |
| secret | `PRODUCTION_DATABASE_URL` | pooled connection string for the `production` branch |
| secret | `PAYLOAD_SECRET` | same value the deployed app uses |
| secret | `BETTER_AUTH_SECRET` | only needed for the preview build step |

The Neon GitHub integration can create the first two for you.

Also worth doing in the Neon console once the app is live: mark `production` as
a **protected branch**, which blocks deletion and can restrict connections.

Rather than doing the above by hand, run the wizard — it opens each console
page, tells you exactly what to copy, sets the secrets and the variable, walks
the branch protection and the `production` GitHub Environment, and finishes by
dispatching `migrate-production` to prove the credentials work:

```bash
./scripts/wizard-neon-ci.sh
```

Setting repository secrets, variables and Environments needs **repo admin**; the
wizard checks up front and, if you do not have it, still collects every value and
prints exactly what a repo admin has to apply.

## Local development

There is no local Postgres. Every developer works against a Neon branch, which
is what makes local schema behaviour match production's exactly — a branch is a
copy-on-write fork, so it starts with production's real schema instead of an
approximation of it.

### Which branch should I use?

Start on **`development`**, the shared branch. Move to your own branch the
moment you are about to change the schema — a migration you apply to the shared
branch lands on everyone else's app too, usually while they are mid-task.

```bash
npm run db:branch:new -- dev-justin        # forks from production
npm run db:branch:url -- dev-justin        # pooled connection string
# paste it into .env.local as DATABASE_URL, then:
npm run db:migrate && npm run payload:migrate
```

Per-developer branches are long-lived; name them `dev-<name>` so they are
obviously not throwaways. `npm run db:branch:ls` lists everything.

### Throwaway branches

For a spike, an experiment, or an agent that needs somewhere destructive to
work, create a branch **with an expiry** so it cleans itself up:

```bash
neonctl branches create --project-id bold-bar-07861256 --parent production \
  --name spike-thing --expires-at 2026-09-01T00:00:00Z
```

A branch with an expiry cannot itself have children — fork from `production`
instead of from another temporary branch.

To delete one early, or to clean up a branch created without an expiry:

```bash
npm run db:branch:rm -- rehearsal-cutover
```

Note that forking `production` no longer gives you an empty database — it is
migrated, though only partly (see [CUTOVER.md](../CUTOVER.md) step 5). If what
you need is a branch that starts empty the way a brand-new environment does,
drop the schemas after forking:

```sql
DROP SCHEMA IF EXISTS payload CASCADE;
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
```

Only ever against a throwaway branch. Check the host in your `DATABASE_URL`
against `npm run db:branch:url` before running it.

### Refreshing a stale branch

Do not hand-repair drift. Reset from the parent and re-apply migrations:

```bash
npm run db:branch:reset -- dev-justin
npm run db:migrate && npm run payload:migrate
npm run migrate:content        # if you want content too
```

### First-run setup

```bash
cp .env.example .env.local        # then fill in the values
# DATABASE_URL -> your branch's POOLED connection string (the host has -pooler)
npm run db:migrate                # public schema + CREATE SCHEMA payload
npm run payload:migrate           # the payload schema, and the cross-schema FK
npm run migrate:content           # optional: real lesson content from Mongo
npm run dev
```

`PAYLOAD_SECRET` must be set locally or Payload fails to initialise and every
`/admin` and `/api/*` Payload route returns
`"There was an error initializing Payload"`.

`neonctl` needs `neonctl auth` once (it is already installed here at 2.36.0).

### Things that will bite you

- **Use the pooled connection string** (`-pooler` in the host) for the app. The
  direct host is only worth reaching for if a tool misbehaves; both work for
  migrations, which the spike verified.
- **Branches scale to zero** after ~5 minutes idle, so the first query after a
  break takes ~0.5–2s. That is not your code being slow.
- **Storage is billed per branch-GB even while suspended**, so delete branches
  you have finished with. `npm run db:branch:ls` shows what exists.
- **Never point `.env.local` at `production`.** If you need production data,
  fork it into a branch and use that.
