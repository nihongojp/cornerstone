import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "payload"."enum_lessons_blocks_match_pairs_pairing" ADD VALUE 'image';
  ALTER TYPE "payload"."enum__lessons_v_blocks_match_pairs_pairing" ADD VALUE 'image';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."lessons_blocks_match_pairs" ALTER COLUMN "pairing" SET DATA TYPE text;
  ALTER TABLE "payload"."lessons_blocks_match_pairs" ALTER COLUMN "pairing" SET DEFAULT 'meaning'::text;
  DROP TYPE "payload"."enum_lessons_blocks_match_pairs_pairing";
  CREATE TYPE "payload"."enum_lessons_blocks_match_pairs_pairing" AS ENUM('meaning', 'reading', 'kana', 'audio');
  ALTER TABLE "payload"."lessons_blocks_match_pairs" ALTER COLUMN "pairing" SET DEFAULT 'meaning'::"payload"."enum_lessons_blocks_match_pairs_pairing";
  ALTER TABLE "payload"."lessons_blocks_match_pairs" ALTER COLUMN "pairing" SET DATA TYPE "payload"."enum_lessons_blocks_match_pairs_pairing" USING "pairing"::"payload"."enum_lessons_blocks_match_pairs_pairing";
  ALTER TABLE "payload"."_lessons_v_blocks_match_pairs" ALTER COLUMN "pairing" SET DATA TYPE text;
  ALTER TABLE "payload"."_lessons_v_blocks_match_pairs" ALTER COLUMN "pairing" SET DEFAULT 'meaning'::text;
  DROP TYPE "payload"."enum__lessons_v_blocks_match_pairs_pairing";
  CREATE TYPE "payload"."enum__lessons_v_blocks_match_pairs_pairing" AS ENUM('meaning', 'reading', 'kana', 'audio');
  ALTER TABLE "payload"."_lessons_v_blocks_match_pairs" ALTER COLUMN "pairing" SET DEFAULT 'meaning'::"payload"."enum__lessons_v_blocks_match_pairs_pairing";
  ALTER TABLE "payload"."_lessons_v_blocks_match_pairs" ALTER COLUMN "pairing" SET DATA TYPE "payload"."enum__lessons_v_blocks_match_pairs_pairing" USING "pairing"::"payload"."enum__lessons_v_blocks_match_pairs_pairing";`)
}
