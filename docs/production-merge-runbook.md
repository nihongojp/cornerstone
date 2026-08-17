# Production merge runbook — the CMS rework (PR #63)

Merging the CMS rework needs one step that no workflow performs: the content
re-import. This is that step, in order, with what to check after each one.

**Nothing here has been run against production.** It was worked out from the
migration chain and rehearsed on a Neon branch forked from `production`. Read it
before running it, and run it when you can watch it.

## Why there is a manual step at all

`migrate-production.yml` applies schema and only schema. That was fine for every
phase up to now, because a migration and its data moved together.

Phase 4a broke that assumption. It replaced seventeen block types with a library
of eleven, and it moved the content across as a **snapshot transform and
re-import** rather than as SQL — deliberately, because generating Lexical
documents in plpgsql would mean reimplementing the one function that has tests.
The transform ran against `development`. Production never got it.

So production is holding Phase 0 content under what will be a Phase 5 schema,
and the code that ships with this merge cannot read it: Payload resolves a
block array's rows only for types in the *current* config, and the seventeen old
types are gone from it. The rows are still there. Nothing can see them.

The re-import is what closes that gap, and it has to happen between two
migrations — which is also why the old-block drop is not in this PR at all. See
"Release 2" below.

## Where production is now

Applied (from `origin/main`):

| | |
|---|---|
| drizzle | `0000_outstanding_stone_men`, `0001_create_payload_schema`, `0002_phase1_auth` |
| Payload | `initial_content_model`, `lesson_format`, `user_progress_lesson_fk` |

This merge adds one drizzle migration (`0003_phase4b_completions`) and seven
Payload ones, ending at `20260817_223731_phase5_autosave_roles`.

## The window where the site is degraded

There is one, it is unavoidable, and it is worth knowing about before starting
rather than during.

Between the Vercel deploy and the end of the import, **lessons render blank**.
The deployed code reads library blocks; the content in front of it is still old
block rows. There is no ordering that removes this — importing first would break
the *currently* deployed code instead, which cannot read library blocks either.
All that can be done is to make the gap short and expected.

It is minutes, and Cornerstone has no public users yet. `user_progress` on
production holds 10 rows belonging to two real accounts, and those are progress
positions rather than content — the import does not touch them.

If that window is not acceptable on the day, the honest alternative is to put
the site in maintenance first, not to reorder these steps.

## The sequence

### 0. Before merging — rehearse the import

`content:import` is a dry run unless given `--yes`, so this is safe and answers
the question that actually decides the merge: does the snapshot line up with
what production holds?

```bash
DATABASE_URL="<production>" npm run content:import
```

Read the output for two things:

- **Missing media.** The import never creates or deletes media — the bytes are
  not in the snapshot — and it refuses to run when a file the snapshot
  references is not already in the target. Production's media came through the
  Phase 1 upload conversion, so this should be clean, but a refusal here is a
  hard stop, not a warning to push past.
- **The document counts**, against `content/snapshot/manifest.json`.

Do not merge until this dry run is clean.

### 1. Merge PR #63

`migrate-production.yml` fires on the push to `main` and does, in order:
`payload:check-migrations` → `payload:migrate:status` → `db:migrate` →
`payload:migrate`.

Watch it. It should apply one drizzle migration and seven Payload ones. Two
things it will do that are worth recognising rather than being surprised by:

- `20260817_214000_phase4b_spotlight_layout` adds a `spotlight` value to two
  enums. Purely additive.
- `20260817_223731_phase5_autosave_roles` creates `cms_admins_roles` **and
  backfills every existing account as an admin**. That preserves exactly the
  access everyone has today; it does not grant anyone anything new, because
  before this migration every authenticated CMS user could already delete
  everything. Narrowing it is step 4.

If the job fails, it fails atomically — each migration is its own transaction —
and the site is untouched, because Vercel deploys independently of it.

### 2. Import the content

As soon as the migration job is green:

```bash
DATABASE_URL="<production>" npm run content:import -- --yes
```

Upsert by natural key, so it is idempotent and safe to re-run if it dies
partway.

### 3. Verify

```bash
DATABASE_URL="<production>" npm run content:verify
```

Expect **149 media relationships resolved** and no structural failures. It will
also print an editorial to-do list — 30 terms with no pronunciation audio, some
placeholder resource copy — which is a backlog, not a failure, and does not
affect the exit code.

Then load a lesson in a browser. `content:verify` reads through Payload with no
cache in front of it, which is exactly why it is trusted here, but it does not
prove a page renders.

Do **not** trust `npm run parity` for this: `unstable_cache` has answered it
from an entry built before a change twice, once passing a whole pre-migration
lesson. If parity is run against production, treat a pass as no evidence.

### 4. Narrow the admin roles

Everyone is an admin after step 1. In `/admin` → Settings → CMS admins, set the
accounts that should be editors to `editor` alone.

Keep at least one admin. With delete *and* account management both gated on the
role, an estate with no admin cannot be repaired through the UI — only by SQL.

### 5. Release 2 — drop the old block tables

Branch `claude/phase4b-drop-old-blocks`, one migration.

Until this merges, production carries the seventeen old block tables holding
rows nothing can read: the import in step 2 wrote the new library rows and
stranded the old ones. That is deliberate. For one release they are the only
remaining copy of the pre-4a content, which is what makes this merge
recoverable.

Merge it once steps 2 and 3 are done and the site has been looked at. Its guard
requires positive evidence that every exercise holds a library block, so if it
is merged early it refuses and rolls back cleanly — a failed deploy rather than
lost content. That is the safety net, not the plan.

## If it goes wrong

**The migration job failed.** Nothing was applied; each migration is its own
transaction and a failure rolls back. Fix and re-run — it is `workflow_dispatch`
as well as push-triggered.

**The import failed partway.** Re-run it. Documents upsert on their natural key,
so a second run finishes the job rather than duplicating what landed.

**The content is wrong after the import.** The old rows are still in the
database until Release 2, which is the whole reason Release 2 is separate. Do
not merge it while this is unresolved.

**Rolling the schema back.** `payload migrate:down` reverts the last *batch*,
not one migration. Note that a full roll-back to an empty `payload` schema
cannot be replayed while progress rows exist: dropping `payload.lessons`
destroys the rows that drizzle-owned `public.user_progress` references by slug,
and re-adding the cross-schema foreign key is then correctly refused.
