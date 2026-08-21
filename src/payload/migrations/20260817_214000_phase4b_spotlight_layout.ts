/*
 * Phase 4b, the expand half: `vocabList` gains a `spotlight` layout.
 *
 * Split from `20260817_214041_phase4b_drop_old_blocks` because the two halves
 * cannot run at the same moment. The content re-import writes the new layout, so
 * the enum has to accept it *before* the import; the drops in the other half
 * refuse to run *until* the import has emptied the old block tables. Running
 * them as one migration deadlocks: the import fails with
 * `invalid input value for enum "spotlight"`, and the drop guard then correctly
 * refuses because the old rows are still there.
 *
 * Expand/contract, in other words — the same shape every type change in this
 * project has taken. This half is purely additive and safe to apply ahead of the
 * deploy; the other half is not.
 *
 * The order is:
 *   1. this migration
 *   2. npm run content:import -- --yes
 *   3. 20260817_214041_phase4b_drop_old_blocks
 */
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  /*
   * Both the live table's enum and the `_lessons_v` version mirror's. Payload
   * keeps a separate type per table, and missing the mirror means the value
   * works until someone saves a draft.
   *
   * `ALTER TYPE ... ADD VALUE` runs inside a transaction on PostgreSQL 12+; the
   * restriction that remains is that the new value cannot be *used* in the same
   * transaction, which is why the import is a separate step rather than tidiness.
   */
  await db.execute(sql`
  ALTER TYPE "payload"."enum_lessons_blocks_vocab_list_layout" ADD VALUE 'spotlight';
  `)
  await db.execute(sql`
  ALTER TYPE "payload"."enum__lessons_v_blocks_vocab_list_layout" ADD VALUE 'spotlight';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  /*
   * PostgreSQL cannot remove a value from an enum, so the type is rebuilt
   * without it: drop the default, cast the column to text, drop and recreate the
   * type, then cast back. The cast back is what fails if a row still uses the
   * value — hence the guard, which says so plainly rather than leaving
   * `invalid input value for enum` to be interpreted.
   */
  await db.execute(sql`
  DO $$
  DECLARE
    n bigint;
  BEGIN
    SELECT count(*) INTO n FROM payload.lessons_blocks_vocab_list WHERE layout = 'spotlight';
    IF n > 0 THEN
      RAISE EXCEPTION
        'Phase 4b down: % vocabList block(s) use the "spotlight" layout, which this removes. Those are the stroke-order screens created by scripts/content/author-spotlights.ts — change or delete them first.',
        n;
    END IF;
  END $$;
  `)

  await db.execute(sql`
  ALTER TABLE "payload"."lessons_blocks_vocab_list" ALTER COLUMN "layout" DROP DEFAULT;
  ALTER TABLE "payload"."lessons_blocks_vocab_list" ALTER COLUMN "layout" SET DATA TYPE text;
  DROP TYPE "payload"."enum_lessons_blocks_vocab_list_layout";
  CREATE TYPE "payload"."enum_lessons_blocks_vocab_list_layout" AS ENUM('list', 'flashcards', 'grid');
  ALTER TABLE "payload"."lessons_blocks_vocab_list" ALTER COLUMN "layout" SET DATA TYPE "payload"."enum_lessons_blocks_vocab_list_layout" USING "layout"::"payload"."enum_lessons_blocks_vocab_list_layout";
  ALTER TABLE "payload"."lessons_blocks_vocab_list" ALTER COLUMN "layout" SET DEFAULT 'list'::"payload"."enum_lessons_blocks_vocab_list_layout";

  ALTER TABLE "payload"."_lessons_v_blocks_vocab_list" ALTER COLUMN "layout" DROP DEFAULT;
  ALTER TABLE "payload"."_lessons_v_blocks_vocab_list" ALTER COLUMN "layout" SET DATA TYPE text;
  DROP TYPE "payload"."enum__lessons_v_blocks_vocab_list_layout";
  CREATE TYPE "payload"."enum__lessons_v_blocks_vocab_list_layout" AS ENUM('list', 'flashcards', 'grid');
  ALTER TABLE "payload"."_lessons_v_blocks_vocab_list" ALTER COLUMN "layout" SET DATA TYPE "payload"."enum__lessons_v_blocks_vocab_list_layout" USING "layout"::"payload"."enum__lessons_v_blocks_vocab_list_layout";
  ALTER TABLE "payload"."_lessons_v_blocks_vocab_list" ALTER COLUMN "layout" SET DEFAULT 'list'::"payload"."enum__lessons_v_blocks_vocab_list_layout";
  `)
}
