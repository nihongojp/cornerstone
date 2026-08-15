import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/*
 * `lessons.format` — which player renders a lesson (#20). The column default is
 * 'step', so the backfill below only has to find the flashcard-player lessons.
 *
 * It identifies them structurally, by the block families a lesson actually
 * owns, rather than by course or slug: those are product decisions an editor
 * can change, while "this lesson is built out of legacy-family components" is
 * the thing `format` is really recording. Block rows point straight at their
 * document (`_parent_id` → `lessons.id`) no matter how deeply the blocks field
 * is nested, so no join through `lessons_exercises` is needed.
 *
 * The import sets `format` explicitly too, so a re-import agrees with this.
 */
const LEGACY_BLOCK_TABLES = [
  'connect_the_dots',
  'match_audio_letter',
  'vocabulary_drag_drop',
  'fact_break',
  'flashcard_deck',
]

function backfill(table: string, prefix: string, column: string): string {
  const unions = LEGACY_BLOCK_TABLES.map(
    (b) => `SELECT "_parent_id" FROM "payload"."${prefix}_blocks_${b}"`
  ).join(' UNION ')
  return `UPDATE "payload"."${table}" SET "${column}" = 'flashcard' WHERE "id" IN (${unions});`
}

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_lessons_format" AS ENUM('step', 'flashcard');
  CREATE TYPE "payload"."enum__lessons_v_version_format" AS ENUM('step', 'flashcard');
  ALTER TABLE "payload"."lessons" ADD COLUMN "format" "payload"."enum_lessons_format" DEFAULT 'step';
  ALTER TABLE "payload"."_lessons_v" ADD COLUMN "version_format" "payload"."enum__lessons_v_version_format" DEFAULT 'step';
  CREATE INDEX "lessons_format_idx" ON "payload"."lessons" USING btree ("format");
  CREATE INDEX "_lessons_v_version_version_format_idx" ON "payload"."_lessons_v" USING btree ("version_format");`)

  await db.execute(sql.raw(backfill('lessons', 'lessons', 'format')))
  await db.execute(sql.raw(backfill('_lessons_v', '_lessons_v', 'version_format')))
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "payload"."lessons_format_idx";
  DROP INDEX "payload"."_lessons_v_version_version_format_idx";
  ALTER TABLE "payload"."lessons" DROP COLUMN "format";
  ALTER TABLE "payload"."_lessons_v" DROP COLUMN "version_format";
  DROP TYPE "payload"."enum_lessons_format";
  DROP TYPE "payload"."enum__lessons_v_version_format";`)
}
