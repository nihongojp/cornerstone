-- Custom SQL migration file, put your code below! --

-- D11: a real foreign key from `public.user_progress.lesson_id` to the lesson
-- it records progress against. Hand-written because it crosses the schema
-- boundary — `payload.lessons` is Payload's table, absent from `schema.ts`, so
-- drizzle-kit cannot see the target and Payload cannot see the source. Neither
-- generator will ever emit this; do not expect `db:generate` to reproduce it.
--
-- `lesson_id` holds the lesson SLUG, not a database id (#11). That is what both
-- players send and what `stepKey` resume is built around, so the FK targets the
-- unique `slug` column rather than re-keying progress to Payload's serial id.
--
--   ON UPDATE CASCADE — renaming a slug rewrites it into progress rows instead
--   of orphaning them (#11). Bookmarked lesson URLs still break on a rename, so
--   renames stay rare by convention; the database just stops them being lossy.
--
--   ON DELETE RESTRICT — deleting a lesson that anyone has progress on fails,
--   loudly, rather than destroying that progress (#11, confirmed in #21).
--   Editors should unpublish instead; the `beforeDelete` hook on the Lessons
--   collection says exactly that, and this constraint is what makes it true
--   even when something bypasses the admin.
--
-- The target is `lessons_slug_idx`, a UNIQUE index Payload maintains from
-- `unique: true` on the field. Postgres accepts a unique index as an FK target,
-- and spike #10 verified the constraint survives `payload migrate` — Payload
-- fails loudly rather than silently dropping it.
--
-- Progress rows for a DRAFT lesson are fine: Payload keeps one row per document
-- in `lessons` whatever its publish state, with versions in `_lessons_v`. The
-- FK asks that the lesson exist, not that it be published.

ALTER TABLE "user_progress"
  ADD CONSTRAINT "user_progress_lesson_id_lessons_slug_fk"
  FOREIGN KEY ("lesson_id")
  REFERENCES "payload"."lessons" ("slug")
  ON UPDATE CASCADE
  ON DELETE RESTRICT;
