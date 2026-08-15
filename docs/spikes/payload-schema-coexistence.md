# Spike #10 — Payload `schemaName` coexistence with drizzle-kit in one Postgres

Throwaway spike. Not shippable code. Run against a disposable Neon branch (PG 18.4),
forked from the `cornerstone` project default branch.

Pinned versions: `payload@3.88.0`, `@payloadcms/db-postgres@3.88.0` (exact),
`drizzle-orm@0.45.2` (deduped with Payload's — no conflict), app `drizzle-kit@0.31.10`,
`next@16.3.0`, Node 22.23.1.

## VERDICT: the two-schema architecture HOLDS. No fallback to a second database needed.

## 1. Payload in schema `payload` — PASS

`postgresAdapter({ schemaName: 'payload', push: false })`. `payload migrate:create` +
`payload migrate` produced 14 tables, ALL schema-qualified, plus the enum type in the
`payload` namespace. `payload_migrations` lives at `payload.payload_migrations`;
`to_regclass('public.payload_migrations')` is NULL.

## 2. Coexistence — PASS, both directions

- After `payload migrate`: `public` had 0 tables.
- `drizzle-kit generate` → "No schema changes"; `drizzle-kit migrate` created the 5 app
  tables in `public` + its own bookkeeping in a separate `drizzle` schema. Payload
  untouched (still 14 tables, migration rows unchanged).
- A second Payload migration (`add_prefecture`) applied cleanly afterwards and did not
  reference or touch anything in `public`.

Final state: `payload` 14, `payload_uuid` 14, `public` 5, `drizzle` 1.

## 3. Cross-schema FK with ON UPDATE CASCADE — PASS, and it SURVIVES `payload migrate`

Hand-written drizzle migration `drizzle/0001_cross_schema_fk.sql`:

    ALTER TABLE public.user_progress
      ADD CONSTRAINT user_progress_lesson_id_payload_lessons_slug_fk
      FOREIGN KEY (lesson_id) REFERENCES payload.lessons(slug)
      ON UPDATE CASCADE ON DELETE RESTRICT;

Proven empirically:

- Postgres accepts Payload's **UNIQUE INDEX** (`lessons_slug_idx`) as an FK target —
  Payload does not emit a UNIQUE CONSTRAINT, and that is fine.
- Bad `lesson_id` insert → rejected.
- `UPDATE payload.lessons SET slug=...` → `public.user_progress.lesson_id` cascaded.
- `DELETE` of a referenced lesson → rejected (RESTRICT).
- FK and data both intact after a subsequent `payload migrate`.

### The destructive case is safe-by-failure, not silently destructive

Removing `unique: true` from the `slug` field made Payload generate
`DROP INDEX "payload"."lessons_slug_idx"`. Applying it FAILED:

    error: cannot drop index payload.lessons_slug_idx because other objects depend on it

Payload rolled the migration back transactionally: no row in `payload_migrations`, index
and FK both still present. So the FK cannot be silently dropped — a conflicting Payload
change breaks the deploy loudly instead. Implication: **treat `payload.lessons.slug`'s
`unique: true` as a load-bearing contract.**

## 4. Blocks table/column naming (Payload 3.88)

Collection `lessons` with a `blocks` field named `content`, blocks `vocabItem` and
`multipleChoice`. Note the field name `content` does **not** appear anywhere.

| table | purpose |
| --- | --- |
| `payload.lessons` | document row |
| `payload.lessons_blocks_vocab_item` | one row per `vocabItem` block instance |
| `payload.lessons_blocks_vocab_item_examples` | nested `array` inside that block |
| `payload.lessons_blocks_multiple_choice` | one row per `multipleChoice` block |
| `payload.lessons_blocks_multiple_choice_choices` | nested `array` |
| `payload.lessons_blocks_multiple_choice_difficulty` | `select` + `hasMany` |

Naming rule: `{collection}_blocks_{block_slug_snake_cased}` then `_{subfield}` per nesting
level. Block slug `vocabItem` → `vocab_item`.

Block tables carry:
- `_order integer NOT NULL` — position within the blocks field
- `_parent_id` — FK to parent doc, `ON DELETE cascade ON UPDATE no action`
- `_path text NOT NULL` (+ index) — which blocks field the row belongs to
- `id varchar PRIMARY KEY` — Payload-generated string id, **not** serial/uuid
- `block_name varchar` — the admin-UI block label

Nested array tables use the same `_order` / `_parent_id` / `id varchar` shape but have no
`_path`. `hasMany` select tables differ: unprefixed `order` / `parent_id` / `value`, and
`id serial PRIMARY KEY` (or `uuid` under `idType: 'uuid'`).

Also auto-created even though not declared: `payload_migrations`, `payload_preferences`
(+`_rels`), `payload_locked_documents` (+`_rels`), `payload_kv`, and a default
`users`/`users_sessions` auth collection. **`payload.users` will sit next to
better-auth's `public.user`** — different tables, confusingly similar names. Consider
renaming Payload's auth collection slug (e.g. `cms_admins`) before modelling.

## 4b. `idType: 'uuid'` vs default serial

Verified by applying the same config into schema `payload_uuid`.

| | default | `idType: 'uuid'` |
| --- | --- | --- |
| document `id` | `serial PRIMARY KEY` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| relationship / `_parent_id` cols | `integer` | `uuid` |
| `*_rels.{collection}_id` | `integer` | `uuid` |
| block/array row `id` | `varchar` | `varchar` (unchanged) |
| `hasMany` select row `id` | `serial` | `uuid DEFAULT gen_random_uuid()` |

`idType` only changes document ids and the columns referencing them. Sub-row ids stay
`varchar` either way.

**Recommendation: keep the default serial.** Reasons specific to this project: nothing in
`public` references a Payload document *id* — the cross-schema FK targets `lessons.slug`,
a natural key, so id opacity buys nothing. Serial ids are narrower, index better, and
admin URLs stay short. Switching `idType` later is a full type change on every id and
every relationship column, so decide once, up front. Pick `uuid` only if content ids will
be minted outside Postgres (offline authoring, cross-environment content sync).

## Gotchas the real implementation MUST know

1. **Payload does NOT create the schema.** No `CREATE SCHEMA` in the generated migration.
   First `payload migrate` against a fresh database fails with
   `error: schema "payload" does not exist`. Provision it out of band — the cleanest fix
   is a drizzle-kit migration `0000` containing `CREATE SCHEMA IF NOT EXISTS payload;`,
   so ordering is explicit (drizzle first, then Payload).

2. **Generated migration files do not load under Node 22's native type stripping.**
   Payload emits `import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'`
   — a value import of two types. `payload migrate` dies with
   `SyntaxError: ... does not provide an export named 'MigrateDownArgs'`.
   `NODE_OPTIONS=--no-experimental-strip-types` makes it worse
   (`ERR_UNKNOWN_FILE_EXTENSION` from Payload's bundled tsx 4.22.4).
   Every generated file had to be hand-edited to `import type { ... }` + a separate
   `import { sql }`. **This needs a post-generate codemod or a lint rule, or Vercel
   deploys will fail.** Not schema-related — but it blocks the migration workflow.

3. **Dev-mode `push` poisons `payload migrate`.** Running Payload once with `push: true`
   (the default outside production) inserted a row `name='dev', batch=-1` into
   `payload.payload_migrations`. Every later `payload migrate` then blocks on an
   interactive prompt — "you've dynamically pushed changes... data loss will occur.
   Proceed? (y/N)" — which in CI/Vercel just hangs forever (this spike hit two 300s
   timeouts before diagnosing it). Set `push: false` unconditionally, and if a `dev` row
   ever appears, delete it or pass `--force-accept-warning`.

4. **`push: true` did not damage anything cross-schema.** With a drifted config
   (`unique` removed from slug), the dev push left `lessons_slug_idx`, the cross-schema
   FK, and all of `public` untouched — it silently skipped the conflicting drop. Safe,
   but it means drift persists invisibly in dev. Another reason for `push: false`.

5. **Neon endpoints: both work, for both tools.** `payload migrate`, `payload
   migrate:status`, `drizzle-kit generate` and `drizzle-kit migrate` all succeeded on the
   **pooled** (`-pooler`) endpoint and on the **direct** endpoint. No pgbouncer/prepared-
   statement problem surfaced. The apparent "direct endpoint hangs" symptom was gotcha 3,
   not the endpoint.

6. **`drizzle-kit generate` never sees the hand-written FK** — it diffs `schema.ts`
   against its own snapshot, not the database, and reported "No schema changes" with the
   FK live. Safe. **`drizzle-kit push` was NOT tested** and is the untested mirror risk:
   it diffs against the live DB and could propose dropping a constraint absent from
   `schema.ts`. Ban `db:push` on any environment holding the cross-schema FK.

7. Set `schemaFilter` explicitly to `['public']` in `drizzle.config.ts`. It defaults to
   `public` so nothing broke, but making it explicit documents the boundary.

## Files in this spike

- `payload.config.ts` — schema `payload`, `push: false`, one `lessons` collection w/ blocks
- `payload.uuid.config.ts` — same into schema `payload_uuid` with `idType: 'uuid'`
- `payload-migrations/`, `payload-migrations-uuid/` — generated (imports hand-patched)
- `drizzle/0001_cross_schema_fk.sql` — the cross-schema FK
- `spike-fk-test.sql` — FK enforcement / cascade / restrict proof
- `spike-push-test.mts` — dev-push hazard reproduction
- `pq.sh`, `spike-direct.sh` — psql helper, direct-endpoint runner
