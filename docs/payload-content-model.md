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
