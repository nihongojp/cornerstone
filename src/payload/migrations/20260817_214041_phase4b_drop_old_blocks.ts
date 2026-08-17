/*
 * Phase 4b — delete the old block path.
 *
 * Drops the seventeen legacy block types — 42 tables, counting the
 * `_lessons_v_*` version mirrors.
 *
 * The contract half. `20260817_214000_phase4b_spotlight_layout` is the expand
 * half, and the content re-import goes between the two: this refuses to run
 * until that import has emptied the tables below, and that import cannot run
 * until the enum accepts the new layout.
 *
 * No backfill, because no data moves here: Phase 4a moved all five lessons onto
 * the library as a snapshot transform and re-import, and the eight blocks that
 * could not be mapped are in `content/quarantine.json`. The guard at the top of
 * `up()` is what makes that a check rather than an assumption.
 *
 * `down()` restores the schema, not the content. The rows these tables held were
 * migrated away in 4a; re-creating the tables gives you empty ones. To actually
 * go back, restore the snapshot from git and re-import.
 */
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  /*
   * Refuse to run against content that has not been moved onto the library.
   *
   * Everything below is a DROP and Payload never generates a backfill, so on a
   * database whose lessons still hold old blocks this deletes real content and
   * reports success.
   *
   * -- Why this asks the question from the other side ------------------------
   *
   * The obvious check, "are the old block tables empty?", cannot pass, and
   * finding that out cost an afternoon. Payload deletes a block array's child
   * rows only for block types that are in the *current* config. This branch has
   * already removed the old block definitions, so Payload no longer knows those
   * tables exist: a re-import writes the new rows and silently leaves the old
   * ones behind, attached to the same lesson, at paths that look valid. They are
   * orphans -- no read can see them and content:verify reports the content as
   * clean -- but SELECT count(*) still finds them, and always will.
   *
   * So this asks for positive evidence of migration instead: every exercise must
   * hold at least one library block. On a migrated database that is true by
   * construction; on an unmigrated one the old screens have no library block at
   * their path, and they are named below.
   *
   * A failed migration rolls back atomically, so stopping here costs nothing.
   */
  await db.execute(sql`
  DO $$
  DECLARE
    offenders text;
    n bigint;
  BEGIN
    WITH library AS (
        SELECT _parent_id, _path FROM payload.lessons_blocks_prose
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_dialogue
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_video_lesson
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_grammar_point
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_vocab_list
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_media_figure
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_match_pairs
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_listen_and_choose
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_build_sentence
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_speak_and_score
        UNION ALL SELECT _parent_id, _path FROM payload.lessons_blocks_multiple_choice
    ),
    unmigrated AS (
      SELECT l.slug, e._order
      FROM payload.lessons_exercises e
      JOIN payload.lessons l ON l.id = e._parent_id
      WHERE NOT EXISTS (
        SELECT 1 FROM library b
        WHERE b._parent_id = e._parent_id
          -- _path indexes from 0 and _order from 1.
          AND b._path = 'exercises.' || (e._order - 1) || '.components'
      )
    )
    SELECT count(*), string_agg(slug || ' exercise ' || _order, ', ' ORDER BY slug, _order)
      INTO n, offenders FROM unmigrated;

    IF n > 0 THEN
      RAISE EXCEPTION
        'Phase 4b: % exercise(s) hold no library block, so this content has not been migrated: %. Run "npm run content:migrate-blocks -- --yes --drop-held" then "npm run content:import -- --yes" first; dropping the old tables now would delete it.',
        n, offenders;
    END IF;
  END $$;
  `);

  await db.execute(sql`
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
  DROP TABLE "payload"."_lessons_v_blocks_legacy_json" CASCADE;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."lessons_blocks_video_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_id" integer,
  	"audio_id" integer,
  	"description" varchar,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_terms_page_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"image_id" integer,
  	"audio_id" integer
  );
  
  CREATE TABLE "payload"."lessons_blocks_terms_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"format" varchar,
  	"description" varchar,
  	"content" jsonb,
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
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_content_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_matching_exercise_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"english_translation" varchar,
  	"audio_id" integer,
  	"image_id" integer
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
  	"audio_id" integer,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_term_media_seed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"audio_id" integer,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_match_audio_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"audio_id" integer,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_pronunciation_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"transcript" varchar,
  	"video_id" integer,
  	"audio_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_info_break" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_life_useful_fact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
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
  	"audio_id" integer,
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
  	"audio_id" integer,
  	"image_id" integer,
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
  	"content" jsonb,
  	"prompt" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_flashcard_deck_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"card" varchar,
  	"audio_id" integer
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
  
  CREATE TABLE "payload"."_lessons_v_blocks_video_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_id" integer,
  	"audio_id" integer,
  	"description" varchar,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_terms_page_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"image_id" integer,
  	"audio_id" integer,
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
  	"content" jsonb,
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
  	"content" jsonb,
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
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_matching_exercise_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"english_translation" varchar,
  	"audio_id" integer,
  	"image_id" integer,
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
  	"audio_id" integer,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_term_media_seed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"audio_id" integer,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_match_audio_exercise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"phrase" varchar,
  	"audio_id" integer,
  	"image_id" integer,
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
  	"video_id" integer,
  	"audio_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_info_break" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_life_useful_fact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" jsonb,
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
  	"audio_id" integer,
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
  	"audio_id" integer,
  	"image_id" integer,
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
  	"content" jsonb,
  	"prompt" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"card" varchar,
  	"audio_id" integer,
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
  
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD CONSTRAINT "lessons_blocks_video_page_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD CONSTRAINT "lessons_blocks_video_page_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD CONSTRAINT "lessons_blocks_video_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD CONSTRAINT "lessons_blocks_terms_page_terms_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD CONSTRAINT "lessons_blocks_terms_page_terms_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD CONSTRAINT "lessons_blocks_terms_page_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_terms_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_terms_page" ADD CONSTRAINT "lessons_blocks_terms_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_grammar_page_grammar_points" ADD CONSTRAINT "lessons_blocks_grammar_page_grammar_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_grammar_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_grammar_page" ADD CONSTRAINT "lessons_blocks_grammar_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_content_page" ADD CONSTRAINT "lessons_blocks_content_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD CONSTRAINT "lessons_blocks_matching_exercise_items_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD CONSTRAINT "lessons_blocks_matching_exercise_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD CONSTRAINT "lessons_blocks_matching_exercise_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_matching_exercise"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise" ADD CONSTRAINT "lessons_blocks_matching_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "lessons_blocks_drag_and_drop_puzzle_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "lessons_blocks_drag_and_drop_puzzle_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "lessons_blocks_drag_and_drop_puzzle_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD CONSTRAINT "lessons_blocks_term_media_seed_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD CONSTRAINT "lessons_blocks_term_media_seed_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD CONSTRAINT "lessons_blocks_term_media_seed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD CONSTRAINT "lessons_blocks_match_audio_exercise_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD CONSTRAINT "lessons_blocks_match_audio_exercise_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD CONSTRAINT "lessons_blocks_match_audio_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD CONSTRAINT "lessons_blocks_pronunciation_exercise_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD CONSTRAINT "lessons_blocks_pronunciation_exercise_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD CONSTRAINT "lessons_blocks_pronunciation_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_info_break" ADD CONSTRAINT "lessons_blocks_info_break_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_life_useful_fact" ADD CONSTRAINT "lessons_blocks_life_useful_fact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_connect_the_dots" ADD CONSTRAINT "lessons_blocks_connect_the_dots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" ADD CONSTRAINT "lessons_blocks_match_audio_letter_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" ADD CONSTRAINT "lessons_blocks_match_audio_letter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD CONSTRAINT "lessons_blocks_vocabulary_drag_drop_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD CONSTRAINT "lessons_blocks_vocabulary_drag_drop_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD CONSTRAINT "lessons_blocks_vocabulary_drag_drop_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_fact_break" ADD CONSTRAINT "lessons_blocks_fact_break_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" ADD CONSTRAINT "lessons_blocks_flashcard_deck_cards_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" ADD CONSTRAINT "lessons_blocks_flashcard_deck_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_flashcard_deck"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck" ADD CONSTRAINT "lessons_blocks_flashcard_deck_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_legacy_json" ADD CONSTRAINT "lessons_blocks_legacy_json_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD CONSTRAINT "_lessons_v_blocks_video_page_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD CONSTRAINT "_lessons_v_blocks_video_page_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD CONSTRAINT "_lessons_v_blocks_video_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD CONSTRAINT "_lessons_v_blocks_terms_page_terms_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD CONSTRAINT "_lessons_v_blocks_terms_page_terms_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD CONSTRAINT "_lessons_v_blocks_terms_page_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_terms_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page" ADD CONSTRAINT "_lessons_v_blocks_terms_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_grammar_page_grammar_points" ADD CONSTRAINT "_lessons_v_blocks_grammar_page_grammar_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_grammar_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_grammar_page" ADD CONSTRAINT "_lessons_v_blocks_grammar_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_content_page" ADD CONSTRAINT "_lessons_v_blocks_content_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD CONSTRAINT "_lessons_v_blocks_matching_exercise_items_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD CONSTRAINT "_lessons_v_blocks_matching_exercise_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD CONSTRAINT "_lessons_v_blocks_matching_exercise_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_matching_exercise"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise" ADD CONSTRAINT "_lessons_v_blocks_matching_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "_lessons_v_blocks_drag_and_drop_puzzle_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "_lessons_v_blocks_drag_and_drop_puzzle_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "_lessons_v_blocks_drag_and_drop_puzzle_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD CONSTRAINT "_lessons_v_blocks_term_media_seed_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD CONSTRAINT "_lessons_v_blocks_term_media_seed_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD CONSTRAINT "_lessons_v_blocks_term_media_seed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD CONSTRAINT "_lessons_v_blocks_match_audio_exercise_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD CONSTRAINT "_lessons_v_blocks_match_audio_exercise_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD CONSTRAINT "_lessons_v_blocks_match_audio_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD CONSTRAINT "_lessons_v_blocks_pronunciation_exercise_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD CONSTRAINT "_lessons_v_blocks_pronunciation_exercise_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD CONSTRAINT "_lessons_v_blocks_pronunciation_exercise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_info_break" ADD CONSTRAINT "_lessons_v_blocks_info_break_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_life_useful_fact" ADD CONSTRAINT "_lessons_v_blocks_life_useful_fact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_connect_the_dots" ADD CONSTRAINT "_lessons_v_blocks_connect_the_dots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" ADD CONSTRAINT "_lessons_v_blocks_match_audio_letter_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" ADD CONSTRAINT "_lessons_v_blocks_match_audio_letter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD CONSTRAINT "_lessons_v_blocks_vocabulary_drag_drop_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD CONSTRAINT "_lessons_v_blocks_vocabulary_drag_drop_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD CONSTRAINT "_lessons_v_blocks_vocabulary_drag_drop_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_fact_break" ADD CONSTRAINT "_lessons_v_blocks_fact_break_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" ADD CONSTRAINT "_lessons_v_blocks_flashcard_deck_cards_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" ADD CONSTRAINT "_lessons_v_blocks_flashcard_deck_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_flashcard_deck"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck" ADD CONSTRAINT "_lessons_v_blocks_flashcard_deck_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_legacy_json" ADD CONSTRAINT "_lessons_v_blocks_legacy_json_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "lessons_blocks_video_page_order_idx" ON "payload"."lessons_blocks_video_page" USING btree ("_order");
  CREATE INDEX "lessons_blocks_video_page_parent_id_idx" ON "payload"."lessons_blocks_video_page" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_video_page_path_idx" ON "payload"."lessons_blocks_video_page" USING btree ("_path");
  CREATE INDEX "lessons_blocks_video_page_video_idx" ON "payload"."lessons_blocks_video_page" USING btree ("video_id");
  CREATE INDEX "lessons_blocks_video_page_audio_idx" ON "payload"."lessons_blocks_video_page" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_terms_page_terms_order_idx" ON "payload"."lessons_blocks_terms_page_terms" USING btree ("_order");
  CREATE INDEX "lessons_blocks_terms_page_terms_parent_id_idx" ON "payload"."lessons_blocks_terms_page_terms" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_terms_page_terms_image_idx" ON "payload"."lessons_blocks_terms_page_terms" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_terms_page_terms_audio_idx" ON "payload"."lessons_blocks_terms_page_terms" USING btree ("audio_id");
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
  CREATE INDEX "lessons_blocks_matching_exercise_items_audio_idx" ON "payload"."lessons_blocks_matching_exercise_items" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_matching_exercise_items_image_idx" ON "payload"."lessons_blocks_matching_exercise_items" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_matching_exercise_order_idx" ON "payload"."lessons_blocks_matching_exercise" USING btree ("_order");
  CREATE INDEX "lessons_blocks_matching_exercise_parent_id_idx" ON "payload"."lessons_blocks_matching_exercise" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_matching_exercise_path_idx" ON "payload"."lessons_blocks_matching_exercise" USING btree ("_path");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_order_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("_order");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_parent_id_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_path_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("_path");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_audio_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_image_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_term_media_seed_order_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("_order");
  CREATE INDEX "lessons_blocks_term_media_seed_parent_id_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_term_media_seed_path_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("_path");
  CREATE INDEX "lessons_blocks_term_media_seed_audio_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_term_media_seed_image_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_match_audio_exercise_order_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("_order");
  CREATE INDEX "lessons_blocks_match_audio_exercise_parent_id_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_match_audio_exercise_path_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("_path");
  CREATE INDEX "lessons_blocks_match_audio_exercise_audio_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_match_audio_exercise_image_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_order_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("_order");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_parent_id_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_path_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("_path");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_video_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("video_id");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_audio_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("audio_id");
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
  CREATE INDEX "lessons_blocks_match_audio_letter_audio_idx" ON "payload"."lessons_blocks_match_audio_letter" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_order_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("_order");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_parent_id_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_path_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("_path");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_audio_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_image_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_fact_break_order_idx" ON "payload"."lessons_blocks_fact_break" USING btree ("_order");
  CREATE INDEX "lessons_blocks_fact_break_parent_id_idx" ON "payload"."lessons_blocks_fact_break" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_fact_break_path_idx" ON "payload"."lessons_blocks_fact_break" USING btree ("_path");
  CREATE INDEX "lessons_blocks_flashcard_deck_cards_order_idx" ON "payload"."lessons_blocks_flashcard_deck_cards" USING btree ("_order");
  CREATE INDEX "lessons_blocks_flashcard_deck_cards_parent_id_idx" ON "payload"."lessons_blocks_flashcard_deck_cards" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_flashcard_deck_cards_audio_idx" ON "payload"."lessons_blocks_flashcard_deck_cards" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_flashcard_deck_order_idx" ON "payload"."lessons_blocks_flashcard_deck" USING btree ("_order");
  CREATE INDEX "lessons_blocks_flashcard_deck_parent_id_idx" ON "payload"."lessons_blocks_flashcard_deck" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_flashcard_deck_path_idx" ON "payload"."lessons_blocks_flashcard_deck" USING btree ("_path");
  CREATE INDEX "lessons_blocks_legacy_json_order_idx" ON "payload"."lessons_blocks_legacy_json" USING btree ("_order");
  CREATE INDEX "lessons_blocks_legacy_json_parent_id_idx" ON "payload"."lessons_blocks_legacy_json" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_legacy_json_path_idx" ON "payload"."lessons_blocks_legacy_json" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_video_page_order_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_video_page_parent_id_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_video_page_path_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_video_page_video_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("video_id");
  CREATE INDEX "_lessons_v_blocks_video_page_audio_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_terms_page_terms_order_idx" ON "payload"."_lessons_v_blocks_terms_page_terms" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_terms_page_terms_parent_id_idx" ON "payload"."_lessons_v_blocks_terms_page_terms" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_terms_page_terms_image_idx" ON "payload"."_lessons_v_blocks_terms_page_terms" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_terms_page_terms_audio_idx" ON "payload"."_lessons_v_blocks_terms_page_terms" USING btree ("audio_id");
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
  CREATE INDEX "_lessons_v_blocks_matching_exercise_items_audio_idx" ON "payload"."_lessons_v_blocks_matching_exercise_items" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_items_image_idx" ON "payload"."_lessons_v_blocks_matching_exercise_items" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_order_idx" ON "payload"."_lessons_v_blocks_matching_exercise" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_parent_id_idx" ON "payload"."_lessons_v_blocks_matching_exercise" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_path_idx" ON "payload"."_lessons_v_blocks_matching_exercise" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_order_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_parent_id_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_path_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_audio_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_image_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_order_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_parent_id_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_path_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_audio_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_image_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_order_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_parent_id_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_path_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_audio_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_image_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_order_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_parent_id_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_path_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_video_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("video_id");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_audio_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("audio_id");
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
  CREATE INDEX "_lessons_v_blocks_match_audio_letter_audio_idx" ON "payload"."_lessons_v_blocks_match_audio_letter" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_order_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_parent_id_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_path_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_audio_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_image_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_fact_break_order_idx" ON "payload"."_lessons_v_blocks_fact_break" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_fact_break_parent_id_idx" ON "payload"."_lessons_v_blocks_fact_break" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_fact_break_path_idx" ON "payload"."_lessons_v_blocks_fact_break" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_cards_order_idx" ON "payload"."_lessons_v_blocks_flashcard_deck_cards" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_cards_parent_id_idx" ON "payload"."_lessons_v_blocks_flashcard_deck_cards" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_cards_audio_idx" ON "payload"."_lessons_v_blocks_flashcard_deck_cards" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_order_idx" ON "payload"."_lessons_v_blocks_flashcard_deck" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_parent_id_idx" ON "payload"."_lessons_v_blocks_flashcard_deck" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_path_idx" ON "payload"."_lessons_v_blocks_flashcard_deck" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_legacy_json_order_idx" ON "payload"."_lessons_v_blocks_legacy_json" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_legacy_json_parent_id_idx" ON "payload"."_lessons_v_blocks_legacy_json" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_legacy_json_path_idx" ON "payload"."_lessons_v_blocks_legacy_json" USING btree ("_path");`)
}
