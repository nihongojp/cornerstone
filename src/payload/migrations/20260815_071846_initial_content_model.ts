import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_courses_track_type" AS ENUM('beginner-to-intermediate', '2-week-crash-course');
  CREATE TYPE "payload"."enum_courses_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__courses_v_version_track_type" AS ENUM('beginner-to-intermediate', '2-week-crash-course');
  CREATE TYPE "payload"."enum__courses_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_lessons_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__lessons_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_resources_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__resources_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "payload"."courses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"track_type" "payload"."enum_courses_track_type" DEFAULT 'beginner-to-intermediate',
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_courses_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."_courses_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_track_type" "payload"."enum__courses_v_version_track_type" DEFAULT 'beginner-to-intermediate',
  	"version_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__courses_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."lessons_blocks_video_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_url" varchar,
  	"audio_url" varchar,
  	"description" varchar,
  	"content" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_terms_page_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"image_url" varchar,
  	"audio_url" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_terms_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"format" varchar,
  	"description" varchar,
  	"content" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_grammar_page_grammar_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pattern" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_grammar_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"content" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_content_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"content" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_matching_exercise_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"english_translation" varchar,
  	"audio_url" varchar,
  	"image_url" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_matching_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"description" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_term_media_seed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_match_audio_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_pronunciation_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"transcript" varchar,
  	"video_url" varchar,
  	"audio_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_info_break" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_life_useful_fact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_connect_the_dots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"exercise_id" varchar,
  	"prompt" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_match_audio_letter" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"exercise_id" varchar,
  	"prompt" varchar,
  	"audio_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_vocabulary_drag_drop" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"exercise_id" varchar,
  	"prompt" varchar,
  	"correct_answer" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"image" varchar,
  	"bonus" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_fact_break" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"exercise_id" varchar,
  	"title" varchar,
  	"content" varchar,
  	"prompt" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_flashcard_deck_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"card" varchar,
  	"audio_url" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_flashcard_deck" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_legacy_json" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"original_type" varchar,
  	"data" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_exercises" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "payload"."lessons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"course_id" integer,
  	"order" numeric,
  	"card_title" varchar,
  	"shuffle_exercises" boolean DEFAULT true,
  	"prefecture" varchar,
  	"version" varchar,
  	"fun_fact" varchar,
  	"notes" varchar,
  	"achievement_title" varchar,
  	"achievement_xp" numeric,
  	"source_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_lessons_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."lessons_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_video_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_url" varchar,
  	"audio_url" varchar,
  	"description" varchar,
  	"content" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_terms_page_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"image_url" varchar,
  	"audio_url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_terms_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"format" varchar,
  	"description" varchar,
  	"content" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_grammar_page_grammar_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"pattern" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_grammar_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"content" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_content_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"content" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_matching_exercise_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"english_translation" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_matching_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"description" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_term_media_seed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_match_audio_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"transcript" varchar,
  	"video_url" varchar,
  	"audio_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_info_break" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_life_useful_fact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_connect_the_dots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"exercise_id" varchar,
  	"prompt" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_match_audio_letter" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"exercise_id" varchar,
  	"prompt" varchar,
  	"audio_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"exercise_id" varchar,
  	"prompt" varchar,
  	"correct_answer" varchar,
  	"audio_url" varchar,
  	"image_url" varchar,
  	"image" varchar,
  	"bonus" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_fact_break" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"exercise_id" varchar,
  	"title" varchar,
  	"content" varchar,
  	"prompt" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"card" varchar,
  	"audio_url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_flashcard_deck" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_legacy_json" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"original_type" varchar,
  	"data" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_version_exercises" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_course_id" integer,
  	"version_order" numeric,
  	"version_card_title" varchar,
  	"version_shuffle_exercises" boolean DEFAULT true,
  	"version_prefecture" varchar,
  	"version_version" varchar,
  	"version_fun_fact" varchar,
  	"version_notes" varchar,
  	"version_achievement_title" varchar,
  	"version_achievement_xp" numeric,
  	"version_source_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__lessons_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."_lessons_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."resources_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" varchar,
  	"title" varchar,
  	"url" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "payload"."resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" varchar,
  	"source_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_resources_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."_resources_v_version_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item_id" varchar,
  	"title" varchar,
  	"url" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_resources_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_category" varchar,
  	"version_source_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__resources_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"caption" varchar,
  	"prefix" varchar DEFAULT '',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload"."cms_admins_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "payload"."cms_admins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"lessons_id" integer,
  	"resources_id" integer,
  	"media_id" integer,
  	"cms_admins_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_admins_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."_courses_v" ADD CONSTRAINT "_courses_v_parent_id_courses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD CONSTRAINT "lessons_blocks_video_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD CONSTRAINT "lessons_blocks_terms_page_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_terms_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_terms_page" ADD CONSTRAINT "lessons_blocks_terms_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_grammar_page_grammar_points" ADD CONSTRAINT "lessons_blocks_grammar_page_grammar_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_grammar_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_grammar_page" ADD CONSTRAINT "lessons_blocks_grammar_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_content_page" ADD CONSTRAINT "lessons_blocks_content_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD CONSTRAINT "lessons_blocks_matching_exercise_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_matching_exercise"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise" ADD CONSTRAINT "lessons_blocks_matching_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "lessons_blocks_drag_and_drop_puzzle_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD CONSTRAINT "lessons_blocks_term_media_seed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD CONSTRAINT "lessons_blocks_match_audio_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD CONSTRAINT "lessons_blocks_pronunciation_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_info_break" ADD CONSTRAINT "lessons_blocks_info_break_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_life_useful_fact" ADD CONSTRAINT "lessons_blocks_life_useful_fact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_connect_the_dots" ADD CONSTRAINT "lessons_blocks_connect_the_dots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" ADD CONSTRAINT "lessons_blocks_match_audio_letter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD CONSTRAINT "lessons_blocks_vocabulary_drag_drop_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_fact_break" ADD CONSTRAINT "lessons_blocks_fact_break_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" ADD CONSTRAINT "lessons_blocks_flashcard_deck_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_flashcard_deck"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck" ADD CONSTRAINT "lessons_blocks_flashcard_deck_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_legacy_json" ADD CONSTRAINT "lessons_blocks_legacy_json_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_exercises" ADD CONSTRAINT "lessons_exercises_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "payload"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_texts" ADD CONSTRAINT "lessons_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD CONSTRAINT "_lessons_v_blocks_video_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD CONSTRAINT "_lessons_v_blocks_terms_page_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_terms_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page" ADD CONSTRAINT "_lessons_v_blocks_terms_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_grammar_page_grammar_points" ADD CONSTRAINT "_lessons_v_blocks_grammar_page_grammar_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_grammar_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_grammar_page" ADD CONSTRAINT "_lessons_v_blocks_grammar_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_content_page" ADD CONSTRAINT "_lessons_v_blocks_content_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD CONSTRAINT "_lessons_v_blocks_matching_exercise_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_matching_exercise"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise" ADD CONSTRAINT "_lessons_v_blocks_matching_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "_lessons_v_blocks_drag_and_drop_puzzle_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD CONSTRAINT "_lessons_v_blocks_term_media_seed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD CONSTRAINT "_lessons_v_blocks_match_audio_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD CONSTRAINT "_lessons_v_blocks_pronunciation_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_info_break" ADD CONSTRAINT "_lessons_v_blocks_info_break_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_life_useful_fact" ADD CONSTRAINT "_lessons_v_blocks_life_useful_fact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_connect_the_dots" ADD CONSTRAINT "_lessons_v_blocks_connect_the_dots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" ADD CONSTRAINT "_lessons_v_blocks_match_audio_letter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD CONSTRAINT "_lessons_v_blocks_vocabulary_drag_drop_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_fact_break" ADD CONSTRAINT "_lessons_v_blocks_fact_break_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" ADD CONSTRAINT "_lessons_v_blocks_flashcard_deck_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_flashcard_deck"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck" ADD CONSTRAINT "_lessons_v_blocks_flashcard_deck_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_legacy_json" ADD CONSTRAINT "_lessons_v_blocks_legacy_json_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_version_exercises" ADD CONSTRAINT "_lessons_v_version_exercises_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v" ADD CONSTRAINT "_lessons_v_parent_id_lessons_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v" ADD CONSTRAINT "_lessons_v_version_course_id_courses_id_fk" FOREIGN KEY ("version_course_id") REFERENCES "payload"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_texts" ADD CONSTRAINT "_lessons_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."resources_items" ADD CONSTRAINT "resources_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_resources_v_version_items" ADD CONSTRAINT "_resources_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_resources_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_resources_v" ADD CONSTRAINT "_resources_v_parent_id_resources_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."resources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_admins_sessions" ADD CONSTRAINT "cms_admins_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "payload"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "payload"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_admins_fk" FOREIGN KEY ("cms_admins_id") REFERENCES "payload"."cms_admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_cms_admins_fk" FOREIGN KEY ("cms_admins_id") REFERENCES "payload"."cms_admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "courses_slug_idx" ON "payload"."courses" USING btree ("slug");
  CREATE INDEX "courses_updated_at_idx" ON "payload"."courses" USING btree ("updated_at");
  CREATE INDEX "courses_created_at_idx" ON "payload"."courses" USING btree ("created_at");
  CREATE INDEX "courses__status_idx" ON "payload"."courses" USING btree ("_status");
  CREATE INDEX "_courses_v_parent_idx" ON "payload"."_courses_v" USING btree ("parent_id");
  CREATE INDEX "_courses_v_version_version_slug_idx" ON "payload"."_courses_v" USING btree ("version_slug");
  CREATE INDEX "_courses_v_version_version_updated_at_idx" ON "payload"."_courses_v" USING btree ("version_updated_at");
  CREATE INDEX "_courses_v_version_version_created_at_idx" ON "payload"."_courses_v" USING btree ("version_created_at");
  CREATE INDEX "_courses_v_version_version__status_idx" ON "payload"."_courses_v" USING btree ("version__status");
  CREATE INDEX "_courses_v_created_at_idx" ON "payload"."_courses_v" USING btree ("created_at");
  CREATE INDEX "_courses_v_updated_at_idx" ON "payload"."_courses_v" USING btree ("updated_at");
  CREATE INDEX "_courses_v_latest_idx" ON "payload"."_courses_v" USING btree ("latest");
  CREATE INDEX "lessons_blocks_video_page_order_idx" ON "payload"."lessons_blocks_video_page" USING btree ("_order");
  CREATE INDEX "lessons_blocks_video_page_parent_id_idx" ON "payload"."lessons_blocks_video_page" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_video_page_path_idx" ON "payload"."lessons_blocks_video_page" USING btree ("_path");
  CREATE INDEX "lessons_blocks_terms_page_terms_order_idx" ON "payload"."lessons_blocks_terms_page_terms" USING btree ("_order");
  CREATE INDEX "lessons_blocks_terms_page_terms_parent_id_idx" ON "payload"."lessons_blocks_terms_page_terms" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_terms_page_order_idx" ON "payload"."lessons_blocks_terms_page" USING btree ("_order");
  CREATE INDEX "lessons_blocks_terms_page_parent_id_idx" ON "payload"."lessons_blocks_terms_page" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_terms_page_path_idx" ON "payload"."lessons_blocks_terms_page" USING btree ("_path");
  CREATE INDEX "lessons_blocks_grammar_page_grammar_points_order_idx" ON "payload"."lessons_blocks_grammar_page_grammar_points" USING btree ("_order");
  CREATE INDEX "lessons_blocks_grammar_page_grammar_points_parent_id_idx" ON "payload"."lessons_blocks_grammar_page_grammar_points" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_grammar_page_order_idx" ON "payload"."lessons_blocks_grammar_page" USING btree ("_order");
  CREATE INDEX "lessons_blocks_grammar_page_parent_id_idx" ON "payload"."lessons_blocks_grammar_page" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_grammar_page_path_idx" ON "payload"."lessons_blocks_grammar_page" USING btree ("_path");
  CREATE INDEX "lessons_blocks_content_page_order_idx" ON "payload"."lessons_blocks_content_page" USING btree ("_order");
  CREATE INDEX "lessons_blocks_content_page_parent_id_idx" ON "payload"."lessons_blocks_content_page" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_content_page_path_idx" ON "payload"."lessons_blocks_content_page" USING btree ("_path");
  CREATE INDEX "lessons_blocks_matching_exercise_items_order_idx" ON "payload"."lessons_blocks_matching_exercise_items" USING btree ("_order");
  CREATE INDEX "lessons_blocks_matching_exercise_items_parent_id_idx" ON "payload"."lessons_blocks_matching_exercise_items" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_matching_exercise_order_idx" ON "payload"."lessons_blocks_matching_exercise" USING btree ("_order");
  CREATE INDEX "lessons_blocks_matching_exercise_parent_id_idx" ON "payload"."lessons_blocks_matching_exercise" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_matching_exercise_path_idx" ON "payload"."lessons_blocks_matching_exercise" USING btree ("_path");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_order_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("_order");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_parent_id_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_path_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("_path");
  CREATE INDEX "lessons_blocks_term_media_seed_order_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("_order");
  CREATE INDEX "lessons_blocks_term_media_seed_parent_id_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_term_media_seed_path_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("_path");
  CREATE INDEX "lessons_blocks_match_audio_exercise_order_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("_order");
  CREATE INDEX "lessons_blocks_match_audio_exercise_parent_id_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_match_audio_exercise_path_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("_path");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_order_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("_order");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_parent_id_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_path_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("_path");
  CREATE INDEX "lessons_blocks_info_break_order_idx" ON "payload"."lessons_blocks_info_break" USING btree ("_order");
  CREATE INDEX "lessons_blocks_info_break_parent_id_idx" ON "payload"."lessons_blocks_info_break" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_info_break_path_idx" ON "payload"."lessons_blocks_info_break" USING btree ("_path");
  CREATE INDEX "lessons_blocks_life_useful_fact_order_idx" ON "payload"."lessons_blocks_life_useful_fact" USING btree ("_order");
  CREATE INDEX "lessons_blocks_life_useful_fact_parent_id_idx" ON "payload"."lessons_blocks_life_useful_fact" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_life_useful_fact_path_idx" ON "payload"."lessons_blocks_life_useful_fact" USING btree ("_path");
  CREATE INDEX "lessons_blocks_connect_the_dots_order_idx" ON "payload"."lessons_blocks_connect_the_dots" USING btree ("_order");
  CREATE INDEX "lessons_blocks_connect_the_dots_parent_id_idx" ON "payload"."lessons_blocks_connect_the_dots" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_connect_the_dots_path_idx" ON "payload"."lessons_blocks_connect_the_dots" USING btree ("_path");
  CREATE INDEX "lessons_blocks_match_audio_letter_order_idx" ON "payload"."lessons_blocks_match_audio_letter" USING btree ("_order");
  CREATE INDEX "lessons_blocks_match_audio_letter_parent_id_idx" ON "payload"."lessons_blocks_match_audio_letter" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_match_audio_letter_path_idx" ON "payload"."lessons_blocks_match_audio_letter" USING btree ("_path");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_order_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("_order");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_parent_id_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_path_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("_path");
  CREATE INDEX "lessons_blocks_fact_break_order_idx" ON "payload"."lessons_blocks_fact_break" USING btree ("_order");
  CREATE INDEX "lessons_blocks_fact_break_parent_id_idx" ON "payload"."lessons_blocks_fact_break" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_fact_break_path_idx" ON "payload"."lessons_blocks_fact_break" USING btree ("_path");
  CREATE INDEX "lessons_blocks_flashcard_deck_cards_order_idx" ON "payload"."lessons_blocks_flashcard_deck_cards" USING btree ("_order");
  CREATE INDEX "lessons_blocks_flashcard_deck_cards_parent_id_idx" ON "payload"."lessons_blocks_flashcard_deck_cards" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_flashcard_deck_order_idx" ON "payload"."lessons_blocks_flashcard_deck" USING btree ("_order");
  CREATE INDEX "lessons_blocks_flashcard_deck_parent_id_idx" ON "payload"."lessons_blocks_flashcard_deck" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_flashcard_deck_path_idx" ON "payload"."lessons_blocks_flashcard_deck" USING btree ("_path");
  CREATE INDEX "lessons_blocks_legacy_json_order_idx" ON "payload"."lessons_blocks_legacy_json" USING btree ("_order");
  CREATE INDEX "lessons_blocks_legacy_json_parent_id_idx" ON "payload"."lessons_blocks_legacy_json" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_legacy_json_path_idx" ON "payload"."lessons_blocks_legacy_json" USING btree ("_path");
  CREATE INDEX "lessons_exercises_order_idx" ON "payload"."lessons_exercises" USING btree ("_order");
  CREATE INDEX "lessons_exercises_parent_id_idx" ON "payload"."lessons_exercises" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "lessons_slug_idx" ON "payload"."lessons" USING btree ("slug");
  CREATE INDEX "lessons_course_idx" ON "payload"."lessons" USING btree ("course_id");
  CREATE UNIQUE INDEX "lessons_source_id_idx" ON "payload"."lessons" USING btree ("source_id");
  CREATE INDEX "lessons_updated_at_idx" ON "payload"."lessons" USING btree ("updated_at");
  CREATE INDEX "lessons_created_at_idx" ON "payload"."lessons" USING btree ("created_at");
  CREATE INDEX "lessons__status_idx" ON "payload"."lessons" USING btree ("_status");
  CREATE INDEX "lessons_texts_order_parent" ON "payload"."lessons_texts" USING btree ("order","parent_id");
  CREATE INDEX "_lessons_v_blocks_video_page_order_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_video_page_parent_id_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_video_page_path_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_terms_page_terms_order_idx" ON "payload"."_lessons_v_blocks_terms_page_terms" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_terms_page_terms_parent_id_idx" ON "payload"."_lessons_v_blocks_terms_page_terms" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_terms_page_order_idx" ON "payload"."_lessons_v_blocks_terms_page" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_terms_page_parent_id_idx" ON "payload"."_lessons_v_blocks_terms_page" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_terms_page_path_idx" ON "payload"."_lessons_v_blocks_terms_page" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_grammar_page_grammar_points_order_idx" ON "payload"."_lessons_v_blocks_grammar_page_grammar_points" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_grammar_page_grammar_points_parent_id_idx" ON "payload"."_lessons_v_blocks_grammar_page_grammar_points" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_grammar_page_order_idx" ON "payload"."_lessons_v_blocks_grammar_page" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_grammar_page_parent_id_idx" ON "payload"."_lessons_v_blocks_grammar_page" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_grammar_page_path_idx" ON "payload"."_lessons_v_blocks_grammar_page" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_content_page_order_idx" ON "payload"."_lessons_v_blocks_content_page" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_content_page_parent_id_idx" ON "payload"."_lessons_v_blocks_content_page" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_content_page_path_idx" ON "payload"."_lessons_v_blocks_content_page" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_items_order_idx" ON "payload"."_lessons_v_blocks_matching_exercise_items" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_items_parent_id_idx" ON "payload"."_lessons_v_blocks_matching_exercise_items" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_order_idx" ON "payload"."_lessons_v_blocks_matching_exercise" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_parent_id_idx" ON "payload"."_lessons_v_blocks_matching_exercise" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_path_idx" ON "payload"."_lessons_v_blocks_matching_exercise" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_order_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_parent_id_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_path_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_order_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_parent_id_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_path_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_order_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_parent_id_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_path_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_order_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_parent_id_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_path_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_info_break_order_idx" ON "payload"."_lessons_v_blocks_info_break" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_info_break_parent_id_idx" ON "payload"."_lessons_v_blocks_info_break" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_info_break_path_idx" ON "payload"."_lessons_v_blocks_info_break" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_life_useful_fact_order_idx" ON "payload"."_lessons_v_blocks_life_useful_fact" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_life_useful_fact_parent_id_idx" ON "payload"."_lessons_v_blocks_life_useful_fact" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_life_useful_fact_path_idx" ON "payload"."_lessons_v_blocks_life_useful_fact" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_connect_the_dots_order_idx" ON "payload"."_lessons_v_blocks_connect_the_dots" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_connect_the_dots_parent_id_idx" ON "payload"."_lessons_v_blocks_connect_the_dots" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_connect_the_dots_path_idx" ON "payload"."_lessons_v_blocks_connect_the_dots" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_match_audio_letter_order_idx" ON "payload"."_lessons_v_blocks_match_audio_letter" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_match_audio_letter_parent_id_idx" ON "payload"."_lessons_v_blocks_match_audio_letter" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_match_audio_letter_path_idx" ON "payload"."_lessons_v_blocks_match_audio_letter" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_order_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_parent_id_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_path_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_fact_break_order_idx" ON "payload"."_lessons_v_blocks_fact_break" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_fact_break_parent_id_idx" ON "payload"."_lessons_v_blocks_fact_break" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_fact_break_path_idx" ON "payload"."_lessons_v_blocks_fact_break" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_cards_order_idx" ON "payload"."_lessons_v_blocks_flashcard_deck_cards" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_cards_parent_id_idx" ON "payload"."_lessons_v_blocks_flashcard_deck_cards" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_order_idx" ON "payload"."_lessons_v_blocks_flashcard_deck" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_parent_id_idx" ON "payload"."_lessons_v_blocks_flashcard_deck" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_path_idx" ON "payload"."_lessons_v_blocks_flashcard_deck" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_legacy_json_order_idx" ON "payload"."_lessons_v_blocks_legacy_json" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_legacy_json_parent_id_idx" ON "payload"."_lessons_v_blocks_legacy_json" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_legacy_json_path_idx" ON "payload"."_lessons_v_blocks_legacy_json" USING btree ("_path");
  CREATE INDEX "_lessons_v_version_exercises_order_idx" ON "payload"."_lessons_v_version_exercises" USING btree ("_order");
  CREATE INDEX "_lessons_v_version_exercises_parent_id_idx" ON "payload"."_lessons_v_version_exercises" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_parent_idx" ON "payload"."_lessons_v" USING btree ("parent_id");
  CREATE INDEX "_lessons_v_version_version_slug_idx" ON "payload"."_lessons_v" USING btree ("version_slug");
  CREATE INDEX "_lessons_v_version_version_course_idx" ON "payload"."_lessons_v" USING btree ("version_course_id");
  CREATE INDEX "_lessons_v_version_version_source_id_idx" ON "payload"."_lessons_v" USING btree ("version_source_id");
  CREATE INDEX "_lessons_v_version_version_updated_at_idx" ON "payload"."_lessons_v" USING btree ("version_updated_at");
  CREATE INDEX "_lessons_v_version_version_created_at_idx" ON "payload"."_lessons_v" USING btree ("version_created_at");
  CREATE INDEX "_lessons_v_version_version__status_idx" ON "payload"."_lessons_v" USING btree ("version__status");
  CREATE INDEX "_lessons_v_created_at_idx" ON "payload"."_lessons_v" USING btree ("created_at");
  CREATE INDEX "_lessons_v_updated_at_idx" ON "payload"."_lessons_v" USING btree ("updated_at");
  CREATE INDEX "_lessons_v_latest_idx" ON "payload"."_lessons_v" USING btree ("latest");
  CREATE INDEX "_lessons_v_texts_order_parent" ON "payload"."_lessons_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "resources_items_order_idx" ON "payload"."resources_items" USING btree ("_order");
  CREATE INDEX "resources_items_parent_id_idx" ON "payload"."resources_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "resources_source_id_idx" ON "payload"."resources" USING btree ("source_id");
  CREATE INDEX "resources_updated_at_idx" ON "payload"."resources" USING btree ("updated_at");
  CREATE INDEX "resources_created_at_idx" ON "payload"."resources" USING btree ("created_at");
  CREATE INDEX "resources__status_idx" ON "payload"."resources" USING btree ("_status");
  CREATE INDEX "_resources_v_version_items_order_idx" ON "payload"."_resources_v_version_items" USING btree ("_order");
  CREATE INDEX "_resources_v_version_items_parent_id_idx" ON "payload"."_resources_v_version_items" USING btree ("_parent_id");
  CREATE INDEX "_resources_v_parent_idx" ON "payload"."_resources_v" USING btree ("parent_id");
  CREATE INDEX "_resources_v_version_version_source_id_idx" ON "payload"."_resources_v" USING btree ("version_source_id");
  CREATE INDEX "_resources_v_version_version_updated_at_idx" ON "payload"."_resources_v" USING btree ("version_updated_at");
  CREATE INDEX "_resources_v_version_version_created_at_idx" ON "payload"."_resources_v" USING btree ("version_created_at");
  CREATE INDEX "_resources_v_version_version__status_idx" ON "payload"."_resources_v" USING btree ("version__status");
  CREATE INDEX "_resources_v_created_at_idx" ON "payload"."_resources_v" USING btree ("created_at");
  CREATE INDEX "_resources_v_updated_at_idx" ON "payload"."_resources_v" USING btree ("updated_at");
  CREATE INDEX "_resources_v_latest_idx" ON "payload"."_resources_v" USING btree ("latest");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE INDEX "cms_admins_sessions_order_idx" ON "payload"."cms_admins_sessions" USING btree ("_order");
  CREATE INDEX "cms_admins_sessions_parent_id_idx" ON "payload"."cms_admins_sessions" USING btree ("_parent_id");
  CREATE INDEX "cms_admins_updated_at_idx" ON "payload"."cms_admins" USING btree ("updated_at");
  CREATE INDEX "cms_admins_created_at_idx" ON "payload"."cms_admins" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_admins_email_idx" ON "payload"."cms_admins" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_rels_lessons_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX "payload_locked_documents_rels_resources_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("resources_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_cms_admins_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_admins_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_cms_admins_id_idx" ON "payload"."payload_preferences_rels" USING btree ("cms_admins_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."courses" CASCADE;
  DROP TABLE "payload"."_courses_v" CASCADE;
  DROP TABLE "payload"."lessons_blocks_video_page" CASCADE;
  DROP TABLE "payload"."lessons_blocks_terms_page_terms" CASCADE;
  DROP TABLE "payload"."lessons_blocks_terms_page" CASCADE;
  DROP TABLE "payload"."lessons_blocks_grammar_page_grammar_points" CASCADE;
  DROP TABLE "payload"."lessons_blocks_grammar_page" CASCADE;
  DROP TABLE "payload"."lessons_blocks_content_page" CASCADE;
  DROP TABLE "payload"."lessons_blocks_matching_exercise_items" CASCADE;
  DROP TABLE "payload"."lessons_blocks_matching_exercise" CASCADE;
  DROP TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" CASCADE;
  DROP TABLE "payload"."lessons_blocks_term_media_seed" CASCADE;
  DROP TABLE "payload"."lessons_blocks_match_audio_exercise" CASCADE;
  DROP TABLE "payload"."lessons_blocks_pronunciation_exercise" CASCADE;
  DROP TABLE "payload"."lessons_blocks_info_break" CASCADE;
  DROP TABLE "payload"."lessons_blocks_life_useful_fact" CASCADE;
  DROP TABLE "payload"."lessons_blocks_connect_the_dots" CASCADE;
  DROP TABLE "payload"."lessons_blocks_match_audio_letter" CASCADE;
  DROP TABLE "payload"."lessons_blocks_vocabulary_drag_drop" CASCADE;
  DROP TABLE "payload"."lessons_blocks_fact_break" CASCADE;
  DROP TABLE "payload"."lessons_blocks_flashcard_deck_cards" CASCADE;
  DROP TABLE "payload"."lessons_blocks_flashcard_deck" CASCADE;
  DROP TABLE "payload"."lessons_blocks_legacy_json" CASCADE;
  DROP TABLE "payload"."lessons_exercises" CASCADE;
  DROP TABLE "payload"."lessons" CASCADE;
  DROP TABLE "payload"."lessons_texts" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_video_page" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_terms_page_terms" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_terms_page" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_grammar_page_grammar_points" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_grammar_page" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_content_page" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_matching_exercise_items" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_matching_exercise" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_term_media_seed" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_match_audio_exercise" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_info_break" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_life_useful_fact" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_connect_the_dots" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_match_audio_letter" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_fact_break" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_flashcard_deck" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_legacy_json" CASCADE;
  DROP TABLE "payload"."_lessons_v_version_exercises" CASCADE;
  DROP TABLE "payload"."_lessons_v" CASCADE;
  DROP TABLE "payload"."_lessons_v_texts" CASCADE;
  DROP TABLE "payload"."resources_items" CASCADE;
  DROP TABLE "payload"."resources" CASCADE;
  DROP TABLE "payload"."_resources_v_version_items" CASCADE;
  DROP TABLE "payload"."_resources_v" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."cms_admins_sessions" CASCADE;
  DROP TABLE "payload"."cms_admins" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TYPE "payload"."enum_courses_track_type";
  DROP TYPE "payload"."enum_courses_status";
  DROP TYPE "payload"."enum__courses_v_version_track_type";
  DROP TYPE "payload"."enum__courses_v_version_status";
  DROP TYPE "payload"."enum_lessons_status";
  DROP TYPE "payload"."enum__lessons_v_version_status";
  DROP TYPE "payload"."enum_resources_status";
  DROP TYPE "payload"."enum__resources_v_version_status";`)
}
