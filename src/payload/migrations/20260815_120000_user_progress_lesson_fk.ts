import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/*
 * The cross-schema foreign key from `public.user_progress.lesson_id` to
 * `payload.lessons(slug)` (#11). It lives here rather than in drizzle, and that
 * placement is the whole point of this file (#44).
 *
 * ── Why it is not a drizzle migration ───────────────────────────────────────
 *
 * It was one — `drizzle/0002_user_progress_lesson_fk.sql` — and on a fresh
 * database that could never work. The constraint needs both `public.user_progress`
 * (drizzle's) and `payload.lessons` (Payload's) to exist, but Payload never
 * issues `CREATE SCHEMA`, so `payload migrate` cannot run until drizzle has
 * created the `payload` schema. Drizzle first, Payload second — and a drizzle
 * migration referencing `payload.lessons` sits on the wrong side of that.
 *
 * Worse than a confusing error: drizzle-orm applies the whole pending set in a
 * single transaction, so 0002 failing rolled back the `CREATE SCHEMA` too, and
 * `npm run db:migrate` exited 1 against an empty database having printed
 * nothing. There was no partial state to resume from.
 *
 * Here, both sides exist by definition: `public` is fully migrated before
 * Payload runs, and `lessons` is created by the initial content-model migration
 * above. This is the first moment in the documented order at which the
 * constraint *can* be created, which is why it is the right moment.
 *
 * ── Why it is guarded ───────────────────────────────────────────────────────
 *
 * Every database that existed before #44 already has this constraint, applied
 * by drizzle 0002, and has never run this migration. So `up` must be a no-op
 * where the constraint is already present rather than failing on it — Postgres
 * has no `ADD CONSTRAINT IF NOT EXISTS`, hence the explicit lookup. The two
 * paths converge on exactly the same constraint.
 *
 * The semantics are unchanged from 0002, and still load-bearing:
 *
 *   ON UPDATE CASCADE — renaming a slug rewrites it into progress rows instead
 *   of orphaning them (#11). Bookmarked lesson URLs still break on a rename, so
 *   renames stay rare by convention; the database just stops them being lossy.
 *
 *   ON DELETE RESTRICT — deleting a lesson that anyone has progress on fails,
 *   loudly, rather than destroying that progress (#11, confirmed in #21).
 *   Editors should unpublish instead; the `beforeDelete` hook on the Lessons
 *   collection says exactly that, and this constraint is what makes it true
 *   even when something bypasses the admin.
 *
 * `lesson_id` holds the lesson SLUG, not a database id (#11) — that is what both
 * players send and what `stepKey` resume is built around — so the target is
 * `lessons_slug_idx`, the UNIQUE index Payload maintains from `unique: true` on
 * the field. Postgres accepts a unique index as an FK target, and spike #10
 * verified the constraint survives `payload migrate`.
 *
 * Neither generator will ever reproduce this: `payload.lessons` is absent from
 * `schema.ts` and `public.user_progress` is invisible to Payload. Do not expect
 * `db:generate` or `migrate:create` to emit it, and do not run `drizzle-kit
 * push`, which diffs against the live database and would propose dropping it.
 */

const CONSTRAINT = 'user_progress_lesson_id_lessons_slug_fk'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = ${sql.raw(`'${CONSTRAINT}'`)}
      ) THEN
        ALTER TABLE "public"."user_progress"
          ADD CONSTRAINT ${sql.raw(`"${CONSTRAINT}"`)}
          FOREIGN KEY ("lesson_id")
          REFERENCES "payload"."lessons" ("slug")
          ON UPDATE CASCADE
          ON DELETE RESTRICT;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`ALTER TABLE "public"."user_progress" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}";`)
  )
}
