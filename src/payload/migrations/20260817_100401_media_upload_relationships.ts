import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."lessons_blocks_video_page" ADD COLUMN "video_id" integer;
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD COLUMN "video_id" integer;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD COLUMN "video_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD COLUMN "video_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" ADD COLUMN "audio_id" integer;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_thumbnail_url" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_thumbnail_width" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_thumbnail_height" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_thumbnail_mime_type" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_thumbnail_filesize" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_thumbnail_filename" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_card_url" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_card_width" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_card_height" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_card_mime_type" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_card_filesize" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_card_filename" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_wide_url" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_wide_width" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_wide_height" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_wide_mime_type" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_wide_filesize" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "sizes_wide_filename" varchar;
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD CONSTRAINT "lessons_blocks_video_page_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD CONSTRAINT "lessons_blocks_video_page_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD CONSTRAINT "lessons_blocks_terms_page_terms_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD CONSTRAINT "lessons_blocks_terms_page_terms_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD CONSTRAINT "lessons_blocks_matching_exercise_items_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD CONSTRAINT "lessons_blocks_matching_exercise_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "lessons_blocks_drag_and_drop_puzzle_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "lessons_blocks_drag_and_drop_puzzle_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD CONSTRAINT "lessons_blocks_term_media_seed_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD CONSTRAINT "lessons_blocks_term_media_seed_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD CONSTRAINT "lessons_blocks_match_audio_exercise_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD CONSTRAINT "lessons_blocks_match_audio_exercise_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD CONSTRAINT "lessons_blocks_pronunciation_exercise_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD CONSTRAINT "lessons_blocks_pronunciation_exercise_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" ADD CONSTRAINT "lessons_blocks_match_audio_letter_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD CONSTRAINT "lessons_blocks_vocabulary_drag_drop_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD CONSTRAINT "lessons_blocks_vocabulary_drag_drop_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" ADD CONSTRAINT "lessons_blocks_flashcard_deck_cards_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD CONSTRAINT "_lessons_v_blocks_video_page_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD CONSTRAINT "_lessons_v_blocks_video_page_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD CONSTRAINT "_lessons_v_blocks_terms_page_terms_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD CONSTRAINT "_lessons_v_blocks_terms_page_terms_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD CONSTRAINT "_lessons_v_blocks_matching_exercise_items_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD CONSTRAINT "_lessons_v_blocks_matching_exercise_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "_lessons_v_blocks_drag_and_drop_puzzle_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD CONSTRAINT "_lessons_v_blocks_drag_and_drop_puzzle_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD CONSTRAINT "_lessons_v_blocks_term_media_seed_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD CONSTRAINT "_lessons_v_blocks_term_media_seed_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD CONSTRAINT "_lessons_v_blocks_match_audio_exercise_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD CONSTRAINT "_lessons_v_blocks_match_audio_exercise_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD CONSTRAINT "_lessons_v_blocks_pronunciation_exercise_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD CONSTRAINT "_lessons_v_blocks_pronunciation_exercise_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" ADD CONSTRAINT "_lessons_v_blocks_match_audio_letter_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD CONSTRAINT "_lessons_v_blocks_vocabulary_drag_drop_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD CONSTRAINT "_lessons_v_blocks_vocabulary_drag_drop_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" ADD CONSTRAINT "_lessons_v_blocks_flashcard_deck_cards_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "lessons_blocks_video_page_video_idx" ON "payload"."lessons_blocks_video_page" USING btree ("video_id");
  CREATE INDEX "lessons_blocks_video_page_audio_idx" ON "payload"."lessons_blocks_video_page" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_terms_page_terms_image_idx" ON "payload"."lessons_blocks_terms_page_terms" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_terms_page_terms_audio_idx" ON "payload"."lessons_blocks_terms_page_terms" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_matching_exercise_items_audio_idx" ON "payload"."lessons_blocks_matching_exercise_items" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_matching_exercise_items_image_idx" ON "payload"."lessons_blocks_matching_exercise_items" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_audio_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_drag_and_drop_puzzle_image_idx" ON "payload"."lessons_blocks_drag_and_drop_puzzle" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_term_media_seed_audio_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_term_media_seed_image_idx" ON "payload"."lessons_blocks_term_media_seed" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_match_audio_exercise_audio_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_match_audio_exercise_image_idx" ON "payload"."lessons_blocks_match_audio_exercise" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_video_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("video_id");
  CREATE INDEX "lessons_blocks_pronunciation_exercise_audio_idx" ON "payload"."lessons_blocks_pronunciation_exercise" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_match_audio_letter_audio_idx" ON "payload"."lessons_blocks_match_audio_letter" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_audio_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("audio_id");
  CREATE INDEX "lessons_blocks_vocabulary_drag_drop_image_idx" ON "payload"."lessons_blocks_vocabulary_drag_drop" USING btree ("image_id");
  CREATE INDEX "lessons_blocks_flashcard_deck_cards_audio_idx" ON "payload"."lessons_blocks_flashcard_deck_cards" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_video_page_video_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("video_id");
  CREATE INDEX "_lessons_v_blocks_video_page_audio_idx" ON "payload"."_lessons_v_blocks_video_page" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_terms_page_terms_image_idx" ON "payload"."_lessons_v_blocks_terms_page_terms" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_terms_page_terms_audio_idx" ON "payload"."_lessons_v_blocks_terms_page_terms" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_items_audio_idx" ON "payload"."_lessons_v_blocks_matching_exercise_items" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_matching_exercise_items_image_idx" ON "payload"."_lessons_v_blocks_matching_exercise_items" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_audio_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_drag_and_drop_puzzle_image_idx" ON "payload"."_lessons_v_blocks_drag_and_drop_puzzle" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_audio_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_term_media_seed_image_idx" ON "payload"."_lessons_v_blocks_term_media_seed" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_audio_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_match_audio_exercise_image_idx" ON "payload"."_lessons_v_blocks_match_audio_exercise" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_video_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("video_id");
  CREATE INDEX "_lessons_v_blocks_pronunciation_exercise_audio_idx" ON "payload"."_lessons_v_blocks_pronunciation_exercise" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_match_audio_letter_audio_idx" ON "payload"."_lessons_v_blocks_match_audio_letter" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_audio_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("audio_id");
  CREATE INDEX "_lessons_v_blocks_vocabulary_drag_drop_image_idx" ON "payload"."_lessons_v_blocks_vocabulary_drag_drop" USING btree ("image_id");
  CREATE INDEX "_lessons_v_blocks_flashcard_deck_cards_audio_idx" ON "payload"."_lessons_v_blocks_flashcard_deck_cards" USING btree ("audio_id");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "payload"."media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "payload"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_wide_sizes_wide_filename_idx" ON "payload"."media" USING btree ("sizes_wide_filename");
  -- ── Backfill: URL string → media relationship ──────────────────────────────
  -- Payload generates the ADD and the DROP but never the data movement between
  -- them. Every legacy value is exactly '/api/media/file/<filename>' and media
  -- rows key on that filename, so the join is exact rather than fuzzy.
  -- Generated from this migration's own DROP list, which is how the
  -- _lessons_v_* version mirrors get covered -- they hold more rows than the
  -- live tables and are the half that gets missed when this is hand-written.
  -- 38 column(s) across base and version tables.

  UPDATE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_flashcard_deck_cards" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_match_audio_exercise" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_match_audio_exercise" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_match_audio_letter" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_matching_exercise_items" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_matching_exercise_items" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_pronunciation_exercise" t SET "video_id" = m.id FROM "payload"."media" m
    WHERE t."video_url" = '/api/media/file/' || m.filename AND t."video_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_pronunciation_exercise" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_term_media_seed" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_term_media_seed" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_terms_page_terms" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_terms_page_terms" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_video_page" t SET "video_id" = m.id FROM "payload"."media" m
    WHERE t."video_url" = '/api/media/file/' || m.filename AND t."video_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_video_page" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_vocabulary_drag_drop" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_vocabulary_drag_drop" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."_lessons_v_blocks_vocabulary_drag_drop" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."lessons_blocks_drag_and_drop_puzzle" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."lessons_blocks_drag_and_drop_puzzle" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_flashcard_deck_cards" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_match_audio_exercise" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."lessons_blocks_match_audio_exercise" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_match_audio_letter" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_matching_exercise_items" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."lessons_blocks_matching_exercise_items" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_pronunciation_exercise" t SET "video_id" = m.id FROM "payload"."media" m
    WHERE t."video_url" = '/api/media/file/' || m.filename AND t."video_id" IS NULL;
  UPDATE "payload"."lessons_blocks_pronunciation_exercise" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_term_media_seed" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."lessons_blocks_term_media_seed" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_terms_page_terms" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."lessons_blocks_terms_page_terms" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_video_page" t SET "video_id" = m.id FROM "payload"."media" m
    WHERE t."video_url" = '/api/media/file/' || m.filename AND t."video_id" IS NULL;
  UPDATE "payload"."lessons_blocks_video_page" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_vocabulary_drag_drop" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image_url" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;
  UPDATE "payload"."lessons_blocks_vocabulary_drag_drop" t SET "audio_id" = m.id FROM "payload"."media" m
    WHERE t."audio_url" = '/api/media/file/' || m.filename AND t."audio_id" IS NULL;
  UPDATE "payload"."lessons_blocks_vocabulary_drag_drop" t SET "image_id" = m.id FROM "payload"."media" m
    WHERE t."image" = '/api/media/file/' || m.filename AND t."image_id" IS NULL;

  -- Refuse to drop a column whose value did not resolve; otherwise the DROP
  -- below turns an unresolvable URL into silent data loss.
  DO $$
  DECLARE unmatched bigint;
  BEGIN
    SELECT 0
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_drag_and_drop_puzzle" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_drag_and_drop_puzzle" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_flashcard_deck_cards" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_match_audio_exercise" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_match_audio_exercise" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_match_audio_letter" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_matching_exercise_items" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_matching_exercise_items" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_pronunciation_exercise" WHERE "video_url" IS NOT NULL AND btrim("video_url") <> '' AND "video_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_pronunciation_exercise" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_term_media_seed" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_term_media_seed" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_terms_page_terms" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_terms_page_terms" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_video_page" WHERE "video_url" IS NOT NULL AND btrim("video_url") <> '' AND "video_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_video_page" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_vocabulary_drag_drop" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_vocabulary_drag_drop" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."_lessons_v_blocks_vocabulary_drag_drop" WHERE "image" IS NOT NULL AND btrim("image") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_drag_and_drop_puzzle" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_drag_and_drop_puzzle" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_flashcard_deck_cards" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_match_audio_exercise" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_match_audio_exercise" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_match_audio_letter" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_matching_exercise_items" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_matching_exercise_items" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_pronunciation_exercise" WHERE "video_url" IS NOT NULL AND btrim("video_url") <> '' AND "video_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_pronunciation_exercise" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_term_media_seed" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_term_media_seed" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_terms_page_terms" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_terms_page_terms" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_video_page" WHERE "video_url" IS NOT NULL AND btrim("video_url") <> '' AND "video_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_video_page" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_vocabulary_drag_drop" WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '' AND "image_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_vocabulary_drag_drop" WHERE "audio_url" IS NOT NULL AND btrim("audio_url") <> '' AND "audio_id" IS NULL)
      + (SELECT count(*) FROM "payload"."lessons_blocks_vocabulary_drag_drop" WHERE "image" IS NOT NULL AND btrim("image") <> '' AND "image_id" IS NULL)
    INTO unmatched;
    IF unmatched > 0 THEN
      RAISE EXCEPTION 'media backfill: % URL(s) matched no media row. Dropping the URL columns now would lose them. Upload the missing files, or clear those values, then re-run.', unmatched;
    END IF;
  END $$;

  -- ── Contract ───────────────────────────────────────────────────────────────

  ALTER TABLE "payload"."lessons_blocks_video_page" DROP COLUMN "video_url";
  ALTER TABLE "payload"."lessons_blocks_video_page" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" DROP COLUMN "image_url";
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" DROP COLUMN "image_url";
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" DROP COLUMN "image_url";
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" DROP COLUMN "image_url";
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" DROP COLUMN "image_url";
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" DROP COLUMN "video_url";
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" DROP COLUMN "image_url";
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" DROP COLUMN "image";
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" DROP COLUMN "video_url";
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" DROP COLUMN "image_url";
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" DROP COLUMN "image_url";
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" DROP COLUMN "image_url";
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" DROP COLUMN "image_url";
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" DROP COLUMN "image_url";
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" DROP COLUMN "video_url";
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" DROP COLUMN "audio_url";
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" DROP COLUMN "image_url";
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" DROP COLUMN "image";
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" DROP COLUMN "audio_url";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."lessons_blocks_video_page" DROP CONSTRAINT "lessons_blocks_video_page_video_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_video_page" DROP CONSTRAINT "lessons_blocks_video_page_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" DROP CONSTRAINT "lessons_blocks_terms_page_terms_image_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" DROP CONSTRAINT "lessons_blocks_terms_page_terms_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" DROP CONSTRAINT "lessons_blocks_matching_exercise_items_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" DROP CONSTRAINT "lessons_blocks_matching_exercise_items_image_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" DROP CONSTRAINT "lessons_blocks_drag_and_drop_puzzle_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" DROP CONSTRAINT "lessons_blocks_drag_and_drop_puzzle_image_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" DROP CONSTRAINT "lessons_blocks_term_media_seed_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" DROP CONSTRAINT "lessons_blocks_term_media_seed_image_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" DROP CONSTRAINT "lessons_blocks_match_audio_exercise_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" DROP CONSTRAINT "lessons_blocks_match_audio_exercise_image_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" DROP CONSTRAINT "lessons_blocks_pronunciation_exercise_video_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" DROP CONSTRAINT "lessons_blocks_pronunciation_exercise_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" DROP CONSTRAINT "lessons_blocks_match_audio_letter_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" DROP CONSTRAINT "lessons_blocks_vocabulary_drag_drop_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" DROP CONSTRAINT "lessons_blocks_vocabulary_drag_drop_image_id_media_id_fk";
  
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" DROP CONSTRAINT "lessons_blocks_flashcard_deck_cards_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" DROP CONSTRAINT "_lessons_v_blocks_video_page_video_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" DROP CONSTRAINT "_lessons_v_blocks_video_page_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" DROP CONSTRAINT "_lessons_v_blocks_terms_page_terms_image_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" DROP CONSTRAINT "_lessons_v_blocks_terms_page_terms_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" DROP CONSTRAINT "_lessons_v_blocks_matching_exercise_items_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" DROP CONSTRAINT "_lessons_v_blocks_matching_exercise_items_image_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" DROP CONSTRAINT "_lessons_v_blocks_drag_and_drop_puzzle_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" DROP CONSTRAINT "_lessons_v_blocks_drag_and_drop_puzzle_image_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" DROP CONSTRAINT "_lessons_v_blocks_term_media_seed_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" DROP CONSTRAINT "_lessons_v_blocks_term_media_seed_image_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" DROP CONSTRAINT "_lessons_v_blocks_match_audio_exercise_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" DROP CONSTRAINT "_lessons_v_blocks_match_audio_exercise_image_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" DROP CONSTRAINT "_lessons_v_blocks_pronunciation_exercise_video_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" DROP CONSTRAINT "_lessons_v_blocks_pronunciation_exercise_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" DROP CONSTRAINT "_lessons_v_blocks_match_audio_letter_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" DROP CONSTRAINT "_lessons_v_blocks_vocabulary_drag_drop_audio_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" DROP CONSTRAINT "_lessons_v_blocks_vocabulary_drag_drop_image_id_media_id_fk";
  
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" DROP CONSTRAINT "_lessons_v_blocks_flashcard_deck_cards_audio_id_media_id_fk";
  
  DROP INDEX "payload"."lessons_blocks_video_page_video_idx";
  DROP INDEX "payload"."lessons_blocks_video_page_audio_idx";
  DROP INDEX "payload"."lessons_blocks_terms_page_terms_image_idx";
  DROP INDEX "payload"."lessons_blocks_terms_page_terms_audio_idx";
  DROP INDEX "payload"."lessons_blocks_matching_exercise_items_audio_idx";
  DROP INDEX "payload"."lessons_blocks_matching_exercise_items_image_idx";
  DROP INDEX "payload"."lessons_blocks_drag_and_drop_puzzle_audio_idx";
  DROP INDEX "payload"."lessons_blocks_drag_and_drop_puzzle_image_idx";
  DROP INDEX "payload"."lessons_blocks_term_media_seed_audio_idx";
  DROP INDEX "payload"."lessons_blocks_term_media_seed_image_idx";
  DROP INDEX "payload"."lessons_blocks_match_audio_exercise_audio_idx";
  DROP INDEX "payload"."lessons_blocks_match_audio_exercise_image_idx";
  DROP INDEX "payload"."lessons_blocks_pronunciation_exercise_video_idx";
  DROP INDEX "payload"."lessons_blocks_pronunciation_exercise_audio_idx";
  DROP INDEX "payload"."lessons_blocks_match_audio_letter_audio_idx";
  DROP INDEX "payload"."lessons_blocks_vocabulary_drag_drop_audio_idx";
  DROP INDEX "payload"."lessons_blocks_vocabulary_drag_drop_image_idx";
  DROP INDEX "payload"."lessons_blocks_flashcard_deck_cards_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_video_page_video_idx";
  DROP INDEX "payload"."_lessons_v_blocks_video_page_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_terms_page_terms_image_idx";
  DROP INDEX "payload"."_lessons_v_blocks_terms_page_terms_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_matching_exercise_items_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_matching_exercise_items_image_idx";
  DROP INDEX "payload"."_lessons_v_blocks_drag_and_drop_puzzle_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_drag_and_drop_puzzle_image_idx";
  DROP INDEX "payload"."_lessons_v_blocks_term_media_seed_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_term_media_seed_image_idx";
  DROP INDEX "payload"."_lessons_v_blocks_match_audio_exercise_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_match_audio_exercise_image_idx";
  DROP INDEX "payload"."_lessons_v_blocks_pronunciation_exercise_video_idx";
  DROP INDEX "payload"."_lessons_v_blocks_pronunciation_exercise_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_match_audio_letter_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_vocabulary_drag_drop_audio_idx";
  DROP INDEX "payload"."_lessons_v_blocks_vocabulary_drag_drop_image_idx";
  DROP INDEX "payload"."_lessons_v_blocks_flashcard_deck_cards_audio_idx";
  DROP INDEX "payload"."media_sizes_thumbnail_sizes_thumbnail_filename_idx";
  DROP INDEX "payload"."media_sizes_card_sizes_card_filename_idx";
  DROP INDEX "payload"."media_sizes_wide_sizes_wide_filename_idx";
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD COLUMN "video_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_video_page" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD COLUMN "video_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" ADD COLUMN "image" varchar;
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD COLUMN "video_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD COLUMN "video_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" ADD COLUMN "image" varchar;
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" ADD COLUMN "audio_url" varchar;
  ALTER TABLE "payload"."lessons_blocks_video_page" DROP COLUMN "video_id";
  ALTER TABLE "payload"."lessons_blocks_video_page" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" DROP COLUMN "image_id";
  ALTER TABLE "payload"."lessons_blocks_terms_page_terms" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_matching_exercise_items" DROP COLUMN "image_id";
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_drag_and_drop_puzzle" DROP COLUMN "image_id";
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_term_media_seed" DROP COLUMN "image_id";
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_match_audio_exercise" DROP COLUMN "image_id";
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" DROP COLUMN "video_id";
  ALTER TABLE "payload"."lessons_blocks_pronunciation_exercise" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_match_audio_letter" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."lessons_blocks_vocabulary_drag_drop" DROP COLUMN "image_id";
  ALTER TABLE "payload"."lessons_blocks_flashcard_deck_cards" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" DROP COLUMN "video_id";
  ALTER TABLE "payload"."_lessons_v_blocks_video_page" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" DROP COLUMN "image_id";
  ALTER TABLE "payload"."_lessons_v_blocks_terms_page_terms" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_matching_exercise_items" DROP COLUMN "image_id";
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_drag_and_drop_puzzle" DROP COLUMN "image_id";
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_term_media_seed" DROP COLUMN "image_id";
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_exercise" DROP COLUMN "image_id";
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" DROP COLUMN "video_id";
  ALTER TABLE "payload"."_lessons_v_blocks_pronunciation_exercise" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_match_audio_letter" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."_lessons_v_blocks_vocabulary_drag_drop" DROP COLUMN "image_id";
  ALTER TABLE "payload"."_lessons_v_blocks_flashcard_deck_cards" DROP COLUMN "audio_id";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_thumbnail_url";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_thumbnail_width";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_thumbnail_height";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_thumbnail_mime_type";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_thumbnail_filesize";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_thumbnail_filename";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_card_url";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_card_width";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_card_height";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_card_mime_type";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_card_filesize";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_card_filename";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_wide_url";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_wide_width";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_wide_height";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_wide_mime_type";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_wide_filesize";
  ALTER TABLE "payload"."media" DROP COLUMN "sizes_wide_filename";`)
}
