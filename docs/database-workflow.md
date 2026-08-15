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

## Local setup

```bash
cp .env.example .env.local        # then fill in the values
# DATABASE_URL -> the `development` branch connection string (pooled)
npm run db:migrate
npm run payload:migrate
```

`PAYLOAD_SECRET` must be set locally or Payload fails to initialise and every
`/admin` and `/api/*` Payload route returns
`"There was an error initializing Payload"`.
