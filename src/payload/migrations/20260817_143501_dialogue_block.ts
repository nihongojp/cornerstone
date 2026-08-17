import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_lessons_blocks_dialogue_lines_speaker" AS ENUM('a', 'b');
  CREATE TYPE "payload"."enum__lessons_v_blocks_dialogue_lines_speaker" AS ENUM('a', 'b');
  CREATE TABLE "payload"."lessons_blocks_dialogue_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"speaker" "payload"."enum_lessons_blocks_dialogue_lines_speaker" DEFAULT 'a',
  	"japanese" jsonb,
  	"romaji" varchar,
  	"english" varchar,
  	"audio_id" integer
  );
  
  CREATE TABLE "payload"."lessons_blocks_dialogue" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"speaker_a" varchar DEFAULT 'A',
  	"speaker_b" varchar DEFAULT 'B',
  	"video_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_dialogue_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"speaker" "payload"."enum__lessons_v_blocks_dialogue_lines_speaker" DEFAULT 'a',
  	"japanese" jsonb,
  	"romaji" varchar,
  	"english" varchar,
  	"audio_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_dialogue" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"speaker_a" varchar DEFAULT 'A',
  	"speaker_b" varchar DEFAULT 'B',
  	"video_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "payload"."lessons_blocks_dialogue_lines" ADD CONSTRAINT "lessons_blocks_dialogue_lines_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_dialogue_lines" ADD CONSTRAINT "lessons_blocks_dialogue_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_dialogue"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_dialogue" ADD CONSTRAINT "lessons_blocks_dialogue_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_dialogue" ADD CONSTRAINT "lessons_blocks_dialogue_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_dialogue_lines" ADD CONSTRAINT "_lessons_v_blocks_dialogue_lines_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_dialogue_lines" ADD CONSTRAINT "_lessons_v_blocks_dialogue_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_dialogue"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_dialogue" ADD CONSTRAINT "_lessons_v_blocks_dialogue_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_dialogue" ADD CONSTRAINT "_lessons_v_blocks_dialogue_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "lessons_blocks_dialogue_lines_order_idx" ON "payload"."lessons_blocks_dialogue_lines" USING btree ("_order");
  CREATE INDEX "lessons_blocks_dialogue_lines_parent_id_idx" ON "payload"."lessons_blocks_dialogue_lines" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_dialogue_lines_audio_idx" ON "payload"."lessons_blocks_dialogue_lines" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_dialogue_order_idx" ON "payload"."lessons_blocks_dialogue" USING btree ("_order");
  CREATE INDEX "lessons_blocks_dialogue_parent_id_idx" ON "payload"."lessons_blocks_dialogue" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_dialogue_path_idx" ON "payload"."lessons_blocks_dialogue" USING btree ("_path");
  CREATE INDEX "lessons_blocks_dialogue_video_idx" ON "payload"."lessons_blocks_dialogue" USING btree ("video_id");
  CREATE INDEX "_lessons_v_blocks_dialogue_lines_order_idx" ON "payload"."_lessons_v_blocks_dialogue_lines" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_dialogue_lines_parent_id_idx" ON "payload"."_lessons_v_blocks_dialogue_lines" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_dialogue_lines_audio_idx" ON "payload"."_lessons_v_blocks_dialogue_lines" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_dialogue_order_idx" ON "payload"."_lessons_v_blocks_dialogue" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_dialogue_parent_id_idx" ON "payload"."_lessons_v_blocks_dialogue" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_dialogue_path_idx" ON "payload"."_lessons_v_blocks_dialogue" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_dialogue_video_idx" ON "payload"."_lessons_v_blocks_dialogue" USING btree ("video_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."lessons_blocks_dialogue_lines" CASCADE;
  DROP TABLE "payload"."lessons_blocks_dialogue" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_dialogue_lines" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_dialogue" CASCADE;
  DROP TYPE "payload"."enum_lessons_blocks_dialogue_lines_speaker";
  DROP TYPE "payload"."enum__lessons_v_blocks_dialogue_lines_speaker";`)
}
