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
  **`format`** is what survives of the split between the two: both formats
  play at the same `/lessons/<slug>` route now (merged once Phase 4b made
  them render the same runner), so `format` no longer selects a URL — it
  only selects which list a lesson appears in, and `flashcard` lessons are
  the ones pinned to the dashboard map. It is a stored field rather than
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

Everything goes through `src/lib/content/content.ts` — `listLessons` and
`listNewLessons` still filter by format for their own listing pages, but
`getLessonBySlug` (the detail lookup) no longer does: it spans both formats,
since they share one route now. Plus `getResources`, and `getLessonRoute` for
resuming, which spans both formats and returns the `href` of the lesson.
`adapters.ts` flattens exercises → components back to the flat `items[]` / `flashcards[]` +
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
hand-written in `src/payload/migrations/20260815_120000_user_progress_lesson_fk.ts`,
and that file is the only place it exists.

It lives in a *Payload* migration despite altering a `public` table, because
that is the first point in the documented order at which both sides of the
constraint exist. It was a drizzle migration until #44, where a fresh database
could not be migrated at all: `payload.lessons` does not exist when drizzle
runs, and because drizzle applies its whole pending set in one transaction, the
failure rolled back the `CREATE SCHEMA payload` that Payload needed next. The
migration is guarded on `pg_constraint`, so it is a no-op on every database
that already had the constraint from the drizzle migration it replaced (deleted
in #44; the `0002` slot in `drizzle/` is free for unrelated work).

Consequences worth knowing:

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
The `media` collection backs every asset — upload there, copy the URL, paste it
into the component. Without `BLOB_READ_WRITE_TOKEN` the adapter silently falls
back to local disk, which is fine locally and useless on Vercel.

**Media is private and auth-gated.** The Blob store is created with private
access, so a raw blob URL 401s to anyone without a token. What ends up in a
component field is Payload's own route, `/api/media/file/<filename>`, which
runs `Media.access.read` first — a valid better-auth session or a `cms_admins`
login — and only then redirects to a short-lived signed URL. Two consequences
worth knowing:

- Signed-out requests for media get a **403**, including from anything
  server-rendered that isn't carrying the user's cookie.
- A signed URL is a bearer capability with no revocation, so it is deliberately
  short-lived. Nothing should ever persist one.

The store's access mode is fixed at creation, and the stock
`@payloadcms/storage-vercel-blob` cannot talk to a private store at all; the
adapter here is our own. See `src/payload/storage/vercelPrivateBlob.ts`.

The Cloudinary back catalogue was migrated into this store by
`scripts/migrate/06-cloudinary-to-blob.ts`; the grandfathering described in #12
no longer applies to content, though the fields are still plain strings and can
still hold an arbitrary absolute URL. Wiring components to real `upload`
relationships is now unblocked but deliberately not done.

## Live preview

Open a lesson or a resource group in `/admin` and there is a **Live Preview**
tab beside **Edit**. It renders the real front end in a panel next to the form
and updates it *as you type* — no save, no reload. The **Preview** button next
to Save opens the same page in its own tab instead.

Only `lessons` and `resources` have it. A course is a grouping with no page of
its own, and media is an upload; neither has anything for the panel to load.
Both lesson formats preview at the same `/lessons/<slug>` route; `format`
only changes which player renders inside it.

Two environment variables turn it on: `PREVIEW_SECRET` and
`NEXT_PUBLIC_SERVER_URL`. Without the secret the feature hides itself rather
than half-working. `NEXT_PUBLIC_SERVER_URL` must be the exact origin `/admin`
is served from — it is what the front end checks incoming preview messages
against, so a wrong value shows a panel that never updates.

**How a draft reaches the page.** The panel's iframe points at `/api/preview`,
not at the page. That route is the only thing in the app that turns Next's
Draft Mode on, and it checks two things before it does: the `previewSecret` in
the URL, and a live `cms_admins` session via `payload.auth()`. The secret only
proves the link came from our admin — Payload puts it in the iframe's `src`,
where any signed-in editor can read it — so the session check is the real
boundary. Once Draft Mode is on, the three previewable pages read through the
draft lookups in `src/lib/content/content.ts`, which are uncached and pass the
authenticated editor through to Payload's access rules.

**Drafts are gated at the collection, not by the app's queries.** `lessons`,
`courses` and `resources` share `readPublishedOrEditor`
(`src/payload/access/readPublished.ts`): signed-in CMS users read everything,
everyone else is constrained to `_status: published`. This is what actually
keeps unpublished work private — the public REST API at `/api/<collection>` is
reachable by anyone, and the previous `read: () => true` applied no filter, so
it served drafts to unauthenticated callers directly. The published filters in
`content.ts` are now a second statement of the same rule rather than the only
one.

The same split applies to the player's own auth gate: a CMS editor has a
`payload-token`, not a better-auth learner session, so
`requirePlayerAccess()` in `src/lib/session.ts` admits either. `src/proxy.ts`
lets the Draft Mode cookie past on presence alone, which is safe only because
the layout behind it re-checks the editor on every request — the cookie is a
build-scoped token that names nobody and outlives the session that obtained it.

**Getting out.** Draft Mode is a cookie on the whole origin and it survives
until the browser closes, so after previewing you keep seeing unpublished
content while browsing normally. Visit **`/api/exit-preview`** to clear it.

Two known edges, both harmless:

- A step lesson's "next lesson" is resolved once when the preview loads. Reorder
  the course while the panel is open and it goes stale until you save and
  reload.
- On `/resources`, only the group you have open updates live. The others show
  what is currently saved, which is the honest rendering of a shared page.

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

### When a password is lost

**The "Forgot password?" link on `/admin` does not work, and it fails
silently.** With no email adapter the endpoint returns `200
{"message":"Success"}` and the server logs `Email attempted without being
configured` — the person waits for a mail that will never arrive. Do not send
anyone there. Recover in this order instead:

1. **Another admin resets it.** Any signed-in admin can open the locked-out
   person under **Settings → CMS admins** and set a new password. No database
   access needed; this is the normal path.
2. **Nobody can sign in.** `forgot-password` does mint a real token even though
   it cannot deliver it, so with database access you can finish the flow by
   hand. Have them click the link, then:

   ```sql
   select email, reset_password_token, reset_password_expiration
   from payload.cms_admins;
   ```

   Open `/admin/reset/<token>` before the expiry, which is one hour.
3. **Last resort:** delete that one row and re-run the seeder for a fresh
   password. Delete only the account being replaced — removing *every* row
   reopens the unauthenticated `create-first-user` screen described below.

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
