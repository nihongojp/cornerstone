import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_terms_kind" AS ENUM('vocab', 'phrase', 'kana', 'kanji');
  CREATE TYPE "payload"."enum_terms_part_of_speech" AS ENUM('noun', 'verb', 'adjective', 'adverb', 'particle', 'expression');
  CREATE TYPE "payload"."enum_terms_jlpt" AS ENUM('N5', 'N4', 'N3', 'N2', 'N1');
  CREATE TABLE "payload"."terms_furigana" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"base" varchar,
  	"ruby" varchar
  );
  
  CREATE TABLE "payload"."terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"kind" "payload"."enum_terms_kind" DEFAULT 'vocab' NOT NULL,
  	"display" varchar,
  	"japanese" varchar,
  	"katakana" varchar,
  	"reading" varchar,
  	"romaji" varchar,
  	"meaning" varchar,
  	"part_of_speech" "payload"."enum_terms_part_of_speech",
  	"jlpt" "payload"."enum_terms_jlpt",
  	"strokes" numeric,
  	"stroke_order_id" integer,
  	"audio_id" integer,
  	"image_id" integer,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."terms_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "terms_id" integer;
  ALTER TABLE "payload"."terms_furigana" ADD CONSTRAINT "terms_furigana_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."terms" ADD CONSTRAINT "terms_stroke_order_id_media_id_fk" FOREIGN KEY ("stroke_order_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."terms" ADD CONSTRAINT "terms_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."terms" ADD CONSTRAINT "terms_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."terms_texts" ADD CONSTRAINT "terms_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "terms_furigana_order_idx" ON "payload"."terms_furigana" USING btree ("_order");
  CREATE INDEX "terms_furigana_parent_id_idx" ON "payload"."terms_furigana" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "terms_key_idx" ON "payload"."terms" USING btree ("key");
  CREATE INDEX "terms_kind_idx" ON "payload"."terms" USING btree ("kind");
  CREATE INDEX "terms_stroke_order_idx" ON "payload"."terms" USING btree ("stroke_order_id");
  CREATE INDEX "terms_audio_idx" ON "payload"."terms" USING btree ("audio_id");
  CREATE INDEX "terms_image_idx" ON "payload"."terms" USING btree ("image_id");
  CREATE INDEX "terms_updated_at_idx" ON "payload"."terms" USING btree ("updated_at");
  CREATE INDEX "terms_created_at_idx" ON "payload"."terms" USING btree ("created_at");
  CREATE INDEX "terms_texts_order_parent" ON "payload"."terms_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_terms_fk" FOREIGN KEY ("terms_id") REFERENCES "payload"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_terms_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("terms_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."terms_furigana" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."terms_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."terms_furigana" CASCADE;
  DROP TABLE "payload"."terms" CASCADE;
  DROP TABLE "payload"."terms_texts" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_terms_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_terms_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "terms_id";
  DROP TYPE "payload"."enum_terms_kind";
  DROP TYPE "payload"."enum_terms_part_of_speech";
  DROP TYPE "payload"."enum_terms_jlpt";`)
}
