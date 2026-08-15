# The Payload content model

How lesson content is shaped in the CMS, and how to run Payload's tooling in
this repo. Companion to `docs/spikes/payload-schema-coexistence.md`, which
explains why Payload and drizzle-kit share one database.

## Shape

```
courses ──< lessons ──< exercises[] ──< components[]
                            (array)       (blocks, one per exercise)
resources        media (uploads → Vercel Blob)        cms_admins (admin login)
```

- **`courses`** — an ordered track. Replaces the old `nextSlug` linked list:
  "what comes next" is `lessons.course` + `lessons.order`.
- **`lessons`** — one collection for both old Mongo collections, legacy
  `lessons` and `newlessons`. Display field is `title`; `newlessons` called it
  `lesson` and the import renames it. Drafts replace the old `isActive`.
  **`format`** is what survives of the split between the two: `flashcard`
  lessons play at `/lesson/<slug>` and are the only ones pinned to the
  dashboard map, `step` lessons play at `/newlesson/<slug>`, and the two lists
  on `/new-lessons` are the two values. It is a stored field rather than
  something derived because the course a lesson sits in is a product decision
  an editor can change, and deriving it from the blocks present would force
  every list query to load every lesson's exercises (#20).
- **`exercises`** — an array field on the lesson, not a collection. An exercise
  belongs to exactly one lesson, is order-sensitive, and has no independent
  lifecycle.
- **components** — a `blocks` field inside each exercise, one block type per
  entry in `KNOWN_GRAMMAR_TYPES` / `KNOWN_LEGACY_TYPES` in
  `src/lib/content/item-schemas.ts`, which stays the source of truth.

**Authoring convention: one component per exercise.** The player renders an
exercise as a single screen and there is no composite renderer, so the blocks
field is capped at one row until there is.

Two source types are split, because the audit found each was two or three
disjoint shapes wearing one name:

| source type | becomes | discriminator |
| --- | --- | --- |
| `page` | `videoPage`, `termsPage`, `grammarPage`, `contentPage` | `classifyPage()` |
| `dragAndDropExercise` | `dragAndDropPuzzle`, `termMediaSeed` | `isDragAndDropPuzzle()` |

`legacyJson` is the escape hatch: anything the import cannot recognise lands
there verbatim and renders nothing. Every one is a to-do.

Deliberately absent: `checkpointPool` (derived at render, #27), `nextSlug`
(course order replaces it), item `number` (unreliable — array position is the
order), and `isActive` (draft/publish).

## How the app reads it

Everything goes through `src/lib/content/content.ts`, which keeps the five
signatures the app has had since the Express controllers — `listLessons`,
`getLessonBySlug`, `listNewLessons`, `getNewLessonBySlug`, `getResources` —
plus `getLessonRoute` for resuming, which spans both formats and returns the
`href` of the player a lesson actually belongs to. `adapters.ts` flattens
exercises → components back to the flat `items[]` / `flashcards[]` +
`exercises[]` shapes in `src/lib/types/lessons.ts`; while one-component-per-
exercise holds, that flattening is item-for-item, so step counts and `stepKey`
resume are unchanged. `nextSlug` is synthesised from course order.

Reads use Payload's **local API** — an in-process query, not HTTP — so there is
no `fetch` for Next to cache and each lookup is wrapped in `unstable_cache`
with the tags in `tags.ts`. The collection hooks in
`src/payload/hooks/revalidate.ts` drop those tags on every save, so a published
edit is live on the next request; the one-hour `revalidate` is only a backstop
for a missed hook. There is no inbound revalidation webhook and no shared
secret — that was Airtable's arrangement, and Payload runs in this process.

Only published documents are read (`_status`), so an unpublished lesson is
invisible to the site even though `/admin` shows it.

## The progress foreign key

`public.user_progress.lesson_id` holds a lesson **slug** and carries a real FK
to `payload.lessons(slug)`, `ON UPDATE CASCADE ON DELETE RESTRICT` (#11, #21).
It crosses the schema boundary, so neither generator emits it — it is
hand-written in `drizzle/0002_user_progress_lesson_fk.sql`, and that file is
the only place it exists. Consequences worth knowing:

- **Renaming a slug rewrites progress rows automatically.** Bookmarked lesson
  URLs still break, so renames stay rare by convention.
- **Deleting a lesson anyone has progress on is refused.** The `beforeDelete`
  hook on Lessons turns that into a readable message telling the editor to
  unpublish instead; the constraint is what makes it true regardless.
- **Postgres will not let a migration drop `lessons_slug_idx` or the `slug`
  column** while the FK exists — a Payload migration that tried would fail
  loudly rather than silently dropping the constraint. Verified, not assumed.
- **Anything writing progress must write the canonical slug.** Both player
  routes also resolve a legacy Mongo id, so the pages pass `lesson.slug` to
  the players rather than the URL segment; passing the segment writes a
  `lesson_id` the FK rejects.
- Progress against a **draft** lesson is fine — the FK asks that the lesson
  exist, not that it be published.

## Media

Component media fields are **plain URL strings**, not `upload` relationships.
Existing Cloudinary URLs are grandfathered and carried across verbatim (#12).
The `media` collection is for new uploads, backed by Vercel Blob — upload
there, copy the URL, paste it into the component. Without
`BLOB_READ_WRITE_TOKEN` the adapter silently falls back to local disk, which is
fine locally and useless on Vercel.

## Running the tooling

```bash
npm run payload:migrate:create <name>   # generate a migration + fix its imports
npm run payload:migrate                 # apply (checks imports first)
npm run payload:migrate:status
npm run payload:types                   # regenerate src/payload/payload-types.ts
```

**These need Node 24.** On Node 22 every one of them dies loading the config
with `ERR_VM_MODULE_LINK_FAILURE: request for '@payloadcms/drizzle' is from a
module not been linked`, which reads like a broken dependency and is not —
`fnm use 24` (or `nvm`) and re-run. Next itself is unaffected, so `npm run dev`
and `npm run build` work on either.

Order matters on a fresh database: **`npm run db:migrate` first**, then
`npm run payload:migrate`. Payload never issues `CREATE SCHEMA`, so
`drizzle/0001_create_payload_schema.sql` has to run before Payload's first
migration or it dies with `schema "payload" does not exist`.

### Two things that look like mistakes but are not

**The `payload` script does not call the `payload` binary directly.** It runs
`node --import tsx/esm node_modules/payload/bin.js --disable-transpile`.
Payload's own bin loads the config through its bundled tsx 4.22.4, which on
Node 24 cannot resolve extensionless relative TypeScript imports — every
`import { Lessons } from "./payload/collections/Lessons"` in the config fails
with `MODULE_NOT_FOUND`. `--disable-transpile` skips that path and
`--import tsx/esm` substitutes the project's own tsx, which resolves them.
Anything else loading `src/payload.config.ts` outside Next — the import script
in #19, for instance — needs the same invocation, and must load `.env.local`
itself (via a dynamic `import()` after `dotenv`), because the config reads
`PAYLOAD_SECRET` at module scope.

**`scripts/payload/fix-migration-imports.mjs` is mandatory, not tidying.**
Payload generates `import { MigrateUpArgs, MigrateDownArgs, sql } from
'@payloadcms/db-postgres'` — a value import of two types. Node 24 strips types
without type-checking, so it emits a real import for all three names and the
migration fails to load:

```
SyntaxError: ... does not provide an export named 'MigrateDownArgs'
```

The script rewrites those to `import type`. `npm run payload:migrate:create`
chains it; `npm run payload:migrate` runs it in `--check` mode first and
refuses to migrate if an unfixed file slipped in. Wire that check into any
deploy pipeline that runs migrations.

## Admin accounts

`cms_admins` is the admin login, and it is deliberately not the learner table —
Better Auth owns learners in `public.user`. Accounts are created by script, not
by hand:

```bash
npm run payload:seed-admins                                # the committed roster
npm run payload:seed-admins -- "Ryoko <ryoko@example.com>" # plus someone else, once
```

It runs against whatever `DATABASE_URL` points at, and it is idempotent by
email: an account that already exists is left completely alone — name, password
and `updatedAt` included — so it is safe to re-run after a partial failure, or
against an environment where only some of the team have accounts. It refuses to
start at all without `PAYLOAD_SECRET` or `DATABASE_URL`, exiting 2 before it
loads Payload rather than dying somewhere inside `buildConfig`.

**Adding a permanent editor is one line** in `ROSTER` at the top of
`scripts/payload/seed-admins.ts`, then a re-run; everyone already there is
skipped. The command-line form is for someone whose address is not settled
enough to commit, and behaves identically otherwise.

New accounts get a generated 24-character password printed to stdout **once**.
Nothing is written to disk and nothing is emailed — Payload has no email
adapter and is not getting one; Resend stays wired to Better Auth. Deliver
through 1Password and have each person change it at `/admin` on first sign-in.

**Seed immediately after the first deploy of a new environment, before the
content import.** While zero `cms_admins` rows exist, Payload serves an
unauthenticated `create-first-user` form at `/admin` to anyone who finds the
URL; the first account closes it permanently (`/api/cms_admins/init` flips to
`{"initialized":true}` and `first-register` starts returning 403). That window
is the whole of #32.

## Do not

- **Do not set `push: true`**, in any environment. One boot with it writes a
  `name='dev', batch=-1` row into `payload_migrations`, after which every
  `payload migrate` blocks on an interactive data-loss prompt and hangs in CI.
- **Do not add a `db:push` script.** `drizzle-kit push` diffs against the live
  database, sees the hand-written cross-schema FK that is absent from
  `schema.ts`, and would propose dropping it.
- **Do not remove `unique: true` from `lessons.slug`.** It backs
  `lessons_slug_idx`, the target of the FK from `public.user_progress`.
  Removing it makes Payload emit a `DROP INDEX` that Postgres refuses — the
  deploy fails loudly, which is the intended behaviour, but know why.
- **Do not set `dbName` on a block to shorten a table name.** It replaces the
  whole name, `lessons_blocks_` prefix included. Block tables are
  `lessons_blocks_<block_slug_snake_cased>` no matter how deeply the blocks
  field is nested; the longest identifier this model produces is 59 characters,
  comfortably under Postgres's 63.
