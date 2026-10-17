import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_lessons_blocks_fill_in_blank_mode" AS ENUM('dropdown', 'typed');
  CREATE TYPE "payload"."enum__lessons_v_blocks_fill_in_blank_mode" AS ENUM('dropdown', 'typed');
  CREATE TABLE "payload"."lessons_blocks_fill_in_blank_blanks" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"answer" varchar
  );
  
  CREATE TABLE "payload"."lessons_blocks_fill_in_blank" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"mode" "payload"."enum_lessons_blocks_fill_in_blank_mode" DEFAULT 'dropdown',
  	"sentence" varchar,
  	"explanation" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_fill_in_blank_blanks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_blocks_fill_in_blank" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"instructions" varchar,
  	"mode" "payload"."enum__lessons_v_blocks_fill_in_blank_mode" DEFAULT 'dropdown',
  	"sentence" varchar,
  	"explanation" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "payload"."lessons_blocks_fill_in_blank_blanks" ADD CONSTRAINT "lessons_blocks_fill_in_blank_blanks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons_blocks_fill_in_blank"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons_blocks_fill_in_blank" ADD CONSTRAINT "lessons_blocks_fill_in_blank_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_fill_in_blank_blanks" ADD CONSTRAINT "_lessons_v_blocks_fill_in_blank_blanks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v_blocks_fill_in_blank"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_blocks_fill_in_blank" ADD CONSTRAINT "_lessons_v_blocks_fill_in_blank_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "lessons_blocks_fill_in_blank_blanks_order_idx" ON "payload"."lessons_blocks_fill_in_blank_blanks" USING btree ("_order");
  CREATE INDEX "lessons_blocks_fill_in_blank_blanks_parent_id_idx" ON "payload"."lessons_blocks_fill_in_blank_blanks" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_fill_in_blank_order_idx" ON "payload"."lessons_blocks_fill_in_blank" USING btree ("_order");
  CREATE INDEX "lessons_blocks_fill_in_blank_parent_id_idx" ON "payload"."lessons_blocks_fill_in_blank" USING btree ("_parent_id");
  CREATE INDEX "lessons_blocks_fill_in_blank_path_idx" ON "payload"."lessons_blocks_fill_in_blank" USING btree ("_path");
  CREATE INDEX "_lessons_v_blocks_fill_in_blank_blanks_order_idx" ON "payload"."_lessons_v_blocks_fill_in_blank_blanks" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_fill_in_blank_blanks_parent_id_idx" ON "payload"."_lessons_v_blocks_fill_in_blank_blanks" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_fill_in_blank_order_idx" ON "payload"."_lessons_v_blocks_fill_in_blank" USING btree ("_order");
  CREATE INDEX "_lessons_v_blocks_fill_in_blank_parent_id_idx" ON "payload"."_lessons_v_blocks_fill_in_blank" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_blocks_fill_in_blank_path_idx" ON "payload"."_lessons_v_blocks_fill_in_blank" USING btree ("_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."lessons_blocks_fill_in_blank_blanks" CASCADE;
  DROP TABLE "payload"."lessons_blocks_fill_in_blank" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_fill_in_blank_blanks" CASCADE;
  DROP TABLE "payload"."_lessons_v_blocks_fill_in_blank" CASCADE;
  DROP TYPE "payload"."enum_lessons_blocks_fill_in_blank_mode";
  DROP TYPE "payload"."enum__lessons_v_blocks_fill_in_blank_mode";`)
}
