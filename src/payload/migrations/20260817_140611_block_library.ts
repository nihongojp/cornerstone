import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/*
 * The ten-block library (Phase 4a): 26 new tables, and nothing else.
 *
 * Generated, unedited, and worth one note because the deploy ordering is the
 * opposite of the previous two content migrations. This is purely additive — no
 * DROP, no RENAME, no ALTER COLUMN — so it is safe to migrate *ahead* of the
 * deploy: the running code simply does not know the new tables exist. Phase 1's
 * `media_upload_relationships` dropped columns and had to go the other way
 * round, which is what broke a worktree that migrated first.
 *
 * No backfill, because no data moves here. The five lessons move onto these
 * blocks as a snapshot transform plus a re-import, not as SQL — the same route
 * the prose upgrade took, and the reason the Phase 0b snapshot exists.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_lessons_blocks_prose_tone" AS ENUM('page', 'card', 'fact', 'lifeTip');
  CREATE TYPE "payload"."enum_lessons_blocks_vocab_list_layout" AS ENUM('list', 'flashcards', 'grid');
  CREATE TYPE "payload"."enum_lessons_blocks_match_pairs_pairing" AS ENUM('meaning', 'reading', 'kana', 'audio');
  CREATE TYPE "payload"."enum_lessons_blocks_listen_and_choose_answer_with" AS ENUM('text', 'image');
  CREATE TYPE "payload"."enum_lessons_blocks_build_sentence_tile_script" AS ENUM('asAuthored', 'romaji');
  CREATE TYPE "payload"."enum__lessons_v_blocks_prose_tone" AS ENUM('page', 'card', 'fact', 'lifeTip');
  CREATE TYPE "payload"."enum__lessons_v_blocks_vocab_list_layout" AS ENUM('list', 'flashcards', 'grid');
  CREATE TYPE "payload"."enum__lessons_v_blocks_match_pairs_pairing" AS ENUM('meaning', 'reading', 'kana', 'audio');
  CREATE TYPE "payload"."enum__lessons_v_blocks_listen_and_choose_answer_with" AS ENUM('text', 'image');
  CREATE TYPE "payload"."enum__lessons_v_blocks_build_sentence_tile_script" AS ENUM('asAuthored', 'romaji');
  CREATE TABLE "payload"."lessons_blocks_prose" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tone" "payload"."enum_lessons_blocks_prose_tone" DEFAULT 'page',
  	"title" varchar,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_video_lesson" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_id" integer,
  	"audio_id" integer,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_grammar_point_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pattern" varchar,
  	"explanation" jsonb
  );
  
  CREATE TABLE "payload"."lessons_blocks_grammar_point" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_vocab_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" jsonb,
  	"layout" "payload"."enum_lessons_blocks_vocab_list_layout" DEFAULT 'list',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_media_figure" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"audio_id" integer,
  	"video_id" integer,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_match_pairs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"pairing" "payload"."enum_lessons_blocks_match_pairs_pairing" DEFAULT 'meaning',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_listen_and_choose" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"term_id" integer,
  	"answer_with" "payload"."enum_lessons_blocks_listen_and_choose_answer_with" DEFAULT 'text',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_build_sentence" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"term_id" integer,
  	"tile_script" "payload"."enum_lessons_blocks_build_sentence_tile_script" DEFAULT 'asAuthored',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_speak_and_score" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"term_id" integer,
  	"transcript" varchar,
  	"video_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_multiple_choice_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"is_correct" boolean
  );
  
  CREATE TABLE "payload"."lessons_blocks_multiple_choice" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" jsonb,
  	"explanation" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"terms_id" integer
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_prose" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tone" "payload"."enum__lessons_v_blocks_prose_tone" DEFAULT 'page',
  	"title" varchar,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_video_lesson" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_id" integer,
  	"audio_id" integer,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_grammar_point_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"pattern" varchar,
  	"explanation" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_grammar_point" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_vocab_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" jsonb,
  	"layout" "payload"."enum__lessons_v_blocks_vocab_list_layout" DEFAULT 'list',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_media_figure" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"audio_id" integer,
  	"video_id" integer,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_match_pairs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"pairing" "payload"."enum__lessons_v_blocks_match_pairs_pairing" DEFAULT 'meaning',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_listen_and_choose" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"term_id" integer,
  	"answer_with" "payload"."enum__lessons_v_blocks_listen_and_choose_answer_with" DEFAULT 'text',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_build_sentence" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"term_id" integer,
  	"tile_script" "payload"."enum__lessons_v_blocks_build_sentence_tile_script" DEFAULT 'asAuthored',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_speak_and_score" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"term_id" integer,
  	"transcript" varchar,
  	"video_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_multiple_choice_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"is_correct" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_multiple_choice" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" jsonb,
  	"explanation" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"terms_id" integer
  );
  
  ALTER TABLE "payload"."lessons_blocks_prose" ADD CONSTRAINT "lessons_blocks_prose_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_video_lesson" ADD CONSTRAINT "lessons_blocks_video_lesson_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_video_lesson" ADD CONSTRAINT "lessons_blocks_video_lesson_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_video_lesson" ADD CONSTRAINT "lessons_blocks_video_lesson_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_grammar_point_points" ADD CONSTRAINT "lessons_blocks_grammar_point_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_grammar_point"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_grammar_point" ADD CONSTRAINT "lessons_blocks_grammar_point_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_vocab_list" ADD CONSTRAINT "lessons_blocks_vocab_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_media_figure" ADD CONSTRAINT "lessons_blocks_media_figure_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_media_figure" ADD CONSTRAINT "lessons_blocks_media_figure_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_media_figure" ADD CONSTRAINT "lessons_blocks_media_figure_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_media_figure" ADD CONSTRAINT "lessons_blocks_media_figure_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_pairs" ADD CONSTRAINT "lessons_blocks_match_pairs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_listen_and_choose" ADD CONSTRAINT "lessons_blocks_listen_and_choose_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "payload"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_listen_and_choose" ADD CONSTRAINT "lessons_blocks_listen_and_choose_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_build_sentence" ADD CONSTRAINT "lessons_blocks_build_sentence_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "payload"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_build_sentence" ADD CONSTRAINT "lessons_blocks_build_sentence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_speak_and_score" ADD CONSTRAINT "lessons_blocks_speak_and_score_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "payload"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_speak_and_score" ADD CONSTRAINT "lessons_blocks_speak_and_score_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_speak_and_score" ADD CONSTRAINT "lessons_blocks_speak_and_score_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_multiple_choice_options" ADD CONSTRAINT "lessons_blocks_multiple_choice_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_multiple_choice"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_multiple_choice" ADD CONSTRAINT "lessons_blocks_multiple_choice_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_rels" ADD CONSTRAINT "lessons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_rels" ADD CONSTRAINT "lessons_rels_terms_fk" FOREIGN KEY ("terms_id") REFERENCES "payload"."terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_prose" ADD CONSTRAINT "_lessons_v_blocks_prose_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_lesson" ADD CONSTRAINT "_lessons_v_blocks_video_lesson_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_lesson" ADD CONSTRAINT "_lessons_v_blocks_video_lesson_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_lesson" ADD CONSTRAINT "_lessons_v_blocks_video_lesson_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_grammar_point_points" ADD CONSTRAINT "_lessons_v_blocks_grammar_point_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_grammar_point"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_grammar_point" ADD CONSTRAINT "_lessons_v_blocks_grammar_point_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_vocab_list" ADD CONSTRAINT "_lessons_v_blocks_vocab_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_media_figure" ADD CONSTRAINT "_lessons_v_blocks_media_figure_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_media_figure" ADD CONSTRAINT "_lessons_v_blocks_media_figure_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_media_figure" ADD CONSTRAINT "_lessons_v_blocks_media_figure_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_media_figure" ADD CONSTRAINT "_lessons_v_blocks_media_figure_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_pairs" ADD CONSTRAINT "_lessons_v_blocks_match_pairs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_listen_and_choose" ADD CONSTRAINT "_lessons_v_blocks_listen_and_choose_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "payload"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_listen_and_choose" ADD CONSTRAINT "_lessons_v_blocks_listen_and_choose_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_build_sentence" ADD CONSTRAINT "_lessons_v_blocks_build_sentence_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "payload"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_build_sentence" ADD CONSTRAINT "_lessons_v_blocks_build_sentence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_speak_and_score" ADD CONSTRAINT "_lessons_v_blocks_speak_and_score_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "payload"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_speak_and_score" ADD CONSTRAINT "_lessons_v_blocks_speak_and_score_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_speak_and_score" ADD CONSTRAINT "_lessons_v_blocks_speak_and_score_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_multiple_choice_options" ADD CONSTRAINT "_lessons_v_blocks_multiple_choice_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_multiple_choice"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_multiple_choice" ADD CONSTRAINT "_lessons_v_blocks_multiple_choice_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_rels" ADD CONSTRAINT "_lessons_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_rels" ADD CONSTRAINT "_lessons_v_rels_terms_fk" FOREIGN KEY ("terms_id") REFERENCES "payload"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "lessons_blocks_prose_order_idx" ON "payload"."lessons_blocks_prose" USING btree ("_order");
  CREATE INDEX "lessons_blocks_prose_parent_id_idx" ON "payload"."lessons_blocks_prose" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_prose_path_idx" ON "payload"."lessons_blocks_prose" USING btree ("_path");
  CREATE INDEX "lessons_blocks_video_lesson_order_idx" ON "payload"."lessons_blocks_video_lesson" USING btree ("_order");
  CREATE INDEX "lessons_blocks_video_lesson_parent_id_idx" ON "payload"."lessons_blocks_video_lesson" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_video_lesson_path_idx" ON "payload"."lessons_blocks_video_lesson" USING btree ("_path");
  CREATE INDEX "lessons_blocks_video_lesson_video_idx" ON "payload"."lessons_blocks_video_lesson" USING btree ("video_id");
  CREATE INDEX "lessons_blocks_video_lesson_audio_idx" ON "payload"."lessons_blocks_video_lesson" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_grammar_point_points_order_idx" ON "payload"."lessons_blocks_grammar_point_points" USING btree ("_order");
  CREATE INDEX "lessons_blocks_grammar_point_points_parent_id_idx" ON "payload"."lessons_blocks_grammar_point_points" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_grammar_point_order_idx" ON "payload"."lessons_blocks_grammar_point" USING btree ("_order");
  CREATE INDEX "lessons_blocks_grammar_point_parent_id_idx" ON "payload"."lessons_blocks_grammar_point" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_grammar_point_path_idx" ON "payload"."lessons_blocks_grammar_point" USING btree ("_path");
  CREATE INDEX "lessons_blocks_vocab_list_order_idx" ON "payload"."lessons_blocks_vocab_list" USING btree ("_order");
  CREATE INDEX "lessons_blocks_vocab_list_parent_id_idx" ON "payload"."lessons_blocks_vocab_list" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_vocab_list_path_idx" ON "payload"."lessons_blocks_vocab_list" USING btree ("_path");
  CREATE INDEX "lessons_blocks_media_figure_order_idx" ON "payload"."lessons_blocks_media_figure" USING btree ("_order");
  CREATE INDEX "lessons_blocks_media_figure_parent_id_idx" ON "payload"."lessons_blocks_media_figure" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_media_figure_path_idx" ON "payload"."lessons_blocks_media_figure" USING btree ("_path");
  CREATE INDEX "lessons_blocks_media_figure_image_idx" ON "payload"."lessons_blocks_media_figure" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_media_figure_audio_idx" ON "payload"."lessons_blocks_media_figure" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_media_figure_video_idx" ON "payload"."lessons_blocks_media_figure" USING btree ("video_id");
  CREATE INDEX "lessons_blocks_match_pairs_order_idx" ON "payload"."lessons_blocks_match_pairs" USING btree ("_order");
  CREATE INDEX "lessons_blocks_match_pairs_parent_id_idx" ON "payload"."lessons_blocks_match_pairs" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_match_pairs_path_idx" ON "payload"."lessons_blocks_match_pairs" USING btree ("_path");
  CREATE INDEX "lessons_blocks_listen_and_choose_order_idx" ON "payload"."lessons_blocks_listen_and_choose" USING btree ("_order");
  CREATE INDEX "lessons_blocks_listen_and_choose_parent_id_idx" ON "payload"."lessons_blocks_listen_and_choose" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_listen_and_choose_path_idx" ON "payload"."lessons_blocks_listen_and_choose" USING btree ("_path");
  CREATE INDEX "lessons_blocks_listen_and_choose_term_idx" ON "payload"."lessons_blocks_listen_and_choose" USING btree ("term_id");
  CREATE INDEX "lessons_blocks_build_sentence_order_idx" ON "payload"."lessons_blocks_build_sentence" USING btree ("_order");
  CREATE INDEX "lessons_blocks_build_sentence_parent_id_idx" ON "payload"."lessons_blocks_build_sentence" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_build_sentence_path_idx" ON "payload"."lessons_blocks_build_sentence" USING btree ("_path");
  CREATE INDEX "lessons_blocks_build_sentence_term_idx" ON "payload"."lessons_blocks_build_sentence" USING btree ("term_id");
  CREATE INDEX "lessons_blocks_speak_and_score_order_idx" ON "payload"."lessons_blocks_speak_and_score" USING btree ("_order");
  CREATE INDEX "lessons_blocks_speak_and_score_parent_id_idx" ON "payload"."lessons_blocks_speak_and_score" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_speak_and_score_path_idx" ON "payload"."lessons_blocks_speak_and_score" USING btree ("_path");
  CREATE INDEX "lessons_blocks_speak_and_score_term_idx" ON "payload"."lessons_blocks_speak_and_score" USING btree ("term_id");
  CREATE INDEX "lessons_blocks_speak_and_score_video_idx" ON "payload"."lessons_blocks_speak_and_score" USING btree ("video_id");
  CREATE INDEX "lessons_blocks_multiple_choice_options_order_idx" ON "payload"."lessons_blocks_multiple_choice_options" USING btree ("_order");
  CREATE INDEX "lessons_blocks_multiple_choice_options_parent_id_idx" ON "payload"."lessons_blocks_multiple_choice_options" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_multiple_choice_order_idx" ON "payload"."lessons_blocks_multiple_choice" USING btree ("_order");
  CREATE INDEX "lessons_blocks_multiple_choice_parent_id_idx" ON "payload"."lessons_blocks_multiple_choice" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_multiple_choice_path_idx" ON "payload"."lessons_blocks_multiple_choice" USING btree ("_path");
  CREATE INDEX "lessons_rels_order_idx" ON "payload"."lessons_rels" USING btree ("order");
  CREATE INDEX "lessons_rels_parent_idx" ON "payload"."lessons_rels" USING btree ("parent_id");
  CREATE INDEX "lessons_rels_path_idx" ON "payload"."lessons_rels" USING btree ("path");
  CREATE INDEX "lessons_rels_terms_id_idx" ON "payload"."lessons_rels" USING btree ("terms_id");
  CREATE INDEX "_lessons_v_blocks_prose_order_idx" ON "payload"."_lessons_v_blocks_prose" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_prose_parent_id_idx" ON "payload"."_lessons_v_blocks_prose" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_prose_path_idx" ON "payload"."_lessons_v_blocks_prose" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_video_lesson_order_idx" ON "payload"."_lessons_v_blocks_video_lesson" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_video_lesson_parent_id_idx" ON "payload"."_lessons_v_blocks_video_lesson" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_video_lesson_path_idx" ON "payload"."_lessons_v_blocks_video_lesson" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_video_lesson_video_idx" ON "payload"."_lessons_v_blocks_video_lesson" USING btree ("video_id");
  CREATE INDEX "_lessons_v_blocks_video_lesson_audio_idx" ON "payload"."_lessons_v_blocks_video_lesson" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_grammar_point_points_order_idx" ON "payload"."_lessons_v_blocks_grammar_point_points" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_grammar_point_points_parent_id_idx" ON "payload"."_lessons_v_blocks_grammar_point_points" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_grammar_point_order_idx" ON "payload"."_lessons_v_blocks_grammar_point" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_grammar_point_parent_id_idx" ON "payload"."_lessons_v_blocks_grammar_point" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_grammar_point_path_idx" ON "payload"."_lessons_v_blocks_grammar_point" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_vocab_list_order_idx" ON "payload"."_lessons_v_blocks_vocab_list" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_vocab_list_parent_id_idx" ON "payload"."_lessons_v_blocks_vocab_list" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_vocab_list_path_idx" ON "payload"."_lessons_v_blocks_vocab_list" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_media_figure_order_idx" ON "payload"."_lessons_v_blocks_media_figure" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_media_figure_parent_id_idx" ON "payload"."_lessons_v_blocks_media_figure" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_media_figure_path_idx" ON "payload"."_lessons_v_blocks_media_figure" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_media_figure_image_idx" ON "payload"."_lessons_v_blocks_media_figure" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_media_figure_audio_idx" ON "payload"."_lessons_v_blocks_media_figure" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_media_figure_video_idx" ON "payload"."_lessons_v_blocks_media_figure" USING btree ("video_id");
  CREATE INDEX "_lessons_v_blocks_match_pairs_order_idx" ON "payload"."_lessons_v_blocks_match_pairs" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_match_pairs_parent_id_idx" ON "payload"."_lessons_v_blocks_match_pairs" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_match_pairs_path_idx" ON "payload"."_lessons_v_blocks_match_pairs" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_listen_and_choose_order_idx" ON "payload"."_lessons_v_blocks_listen_and_choose" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_listen_and_choose_parent_id_idx" ON "payload"."_lessons_v_blocks_listen_and_choose" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_listen_and_choose_path_idx" ON "payload"."_lessons_v_blocks_listen_and_choose" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_listen_and_choose_term_idx" ON "payload"."_lessons_v_blocks_listen_and_choose" USING btree ("term_id");
  CREATE INDEX "_lessons_v_blocks_build_sentence_order_idx" ON "payload"."_lessons_v_blocks_build_sentence" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_build_sentence_parent_id_idx" ON "payload"."_lessons_v_blocks_build_sentence" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_build_sentence_path_idx" ON "payload"."_lessons_v_blocks_build_sentence" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_build_sentence_term_idx" ON "payload"."_lessons_v_blocks_build_sentence" USING btree ("term_id");
  CREATE INDEX "_lessons_v_blocks_speak_and_score_order_idx" ON "payload"."_lessons_v_blocks_speak_and_score" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_speak_and_score_parent_id_idx" ON "payload"."_lessons_v_blocks_speak_and_score" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_speak_and_score_path_idx" ON "payload"."_lessons_v_blocks_speak_and_score" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_speak_and_score_term_idx" ON "payload"."_lessons_v_blocks_speak_and_score" USING btree ("term_id");
  CREATE INDEX "_lessons_v_blocks_speak_and_score_video_idx" ON "payload"."_lessons_v_blocks_speak_and_score" USING btree ("video_id");
  CREATE INDEX "_lessons_v_blocks_multiple_choice_options_order_idx" ON "payload"."_lessons_v_blocks_multiple_choice_options" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_multiple_choice_options_parent_id_idx" ON "payload"."_lessons_v_blocks_multiple_choice_options" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_multiple_choice_order_idx" ON "payload"."_lessons_v_blocks_multiple_choice" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_multiple_choice_parent_id_idx" ON "payload"."_lessons_v_blocks_multiple_choice" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_multiple_choice_path_idx" ON "payload"."_lessons_v_blocks_multiple_choice" USING btree ("_path");
  CREATE INDEX "_lessons_v_rels_order_idx" ON "payload"."_lessons_v_rels" USING btree ("order");
  CREATE INDEX "_lessons_v_rels_parent_idx" ON "payload"."_lessons_v_rels" USING btree ("parent_id");
  CREATE INDEX "_lessons_v_rels_path_idx" ON "payload"."_lessons_v_rels" USING btree ("path");
  CREATE INDEX "_lessons_v_rels_terms_id_idx" ON "payload"."_lessons_v_rels" USING btree ("terms_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."lessons_blocks_prose" CASCADE;
  DROP TABLE "payload"."lessons_blocks_video_lesson" CASCADE;
  DROP TABLE "payload"."lessons_blocks_grammar_point_points" CASCADE;
  DROP TABLE "payload"."lessons_blocks_grammar_point" CASCADE;
  DROP TABLE "payload"."lessons_blocks_vocab_list" CASCADE;
  DROP TABLE "payload"."lessons_blocks_media_figure" CASCADE;
  DROP TABLE "payload"."lessons_blocks_match_pairs" CASCADE;
  DROP TABLE "payload"."lessons_blocks_listen_and_choose" CASCADE;
  DROP TABLE "payload"."lessons_blocks_build_sentence" CASCADE;
  DROP TABLE "payload"."lessons_blocks_speak_and_score" CASCADE;
  DROP TABLE "payload"."lessons_blocks_multiple_choice_options" CASCADE;
  DROP TABLE "payload"."lessons_blocks_multiple_choice" CASCADE;
  DROP TABLE "payload"."lessons_rels" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_prose" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_video_lesson" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_grammar_point_points" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_grammar_point" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_vocab_list" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_media_figure" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_match_pairs" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_listen_and_choose" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_build_sentence" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_speak_and_score" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_multiple_choice_options" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_multiple_choice" CASCADE;
  DROP TABLE "payload"."_lessons_v_rels" CASCADE;
  DROP TYPE "payload"."enum_lessons_blocks_prose_tone";
  DROP TYPE "payload"."enum_lessons_blocks_vocab_list_layout";
  DROP TYPE "payload"."enum_lessons_blocks_match_pairs_pairing";
  DROP TYPE "payload"."enum_lessons_blocks_listen_and_choose_answer_with";
  DROP TYPE "payload"."enum_lessons_blocks_build_sentence_tile_script";
  DROP TYPE "payload"."enum__lessons_v_blocks_prose_tone";
  DROP TYPE "payload"."enum__lessons_v_blocks_vocab_list_layout";
  DROP TYPE "payload"."enum__lessons_v_blocks_match_pairs_pairing";
  DROP TYPE "payload"."enum__lessons_v_blocks_listen_and_choose_answer_with";
  DROP TYPE "payload"."enum__lessons_v_blocks_build_sentence_tile_script";`)
}
