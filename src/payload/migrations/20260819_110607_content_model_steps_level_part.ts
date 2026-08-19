import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."lessons_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_version_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "payload"."lessons_exercises" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_lessons_v_version_exercises" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."lessons_exercises" CASCADE;
  DROP TABLE "payload"."_lessons_v_version_exercises" CASCADE;
  ALTER TABLE "payload"."lessons" ADD COLUMN "level" numeric;
  ALTER TABLE "payload"."lessons" ADD COLUMN "part" numeric DEFAULT 1;
  ALTER TABLE "payload"."lessons" ADD COLUMN "shuffle_steps" boolean DEFAULT true;
  ALTER TABLE "payload"."_lessons_v" ADD COLUMN "version_level" numeric;
  ALTER TABLE "payload"."_lessons_v" ADD COLUMN "version_part" numeric DEFAULT 1;
  ALTER TABLE "payload"."_lessons_v" ADD COLUMN "version_shuffle_steps" boolean DEFAULT true;
  ALTER TABLE "payload"."lessons_steps" ADD CONSTRAINT "lessons_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_version_steps" ADD CONSTRAINT "_lessons_v_version_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "lessons_steps_order_idx" ON "payload"."lessons_steps" USING btree ("_order");
  CREATE INDEX "lessons_steps_parent_id_idx" ON "payload"."lessons_steps" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_version_steps_order_idx" ON "payload"."_lessons_v_version_steps" USING btree ("_order");
  CREATE INDEX "_lessons_v_version_steps_parent_id_idx" ON "payload"."_lessons_v_version_steps" USING btree ("_parent_id");
  CREATE INDEX "lessons_level_idx" ON "payload"."lessons" USING btree ("level");
  CREATE INDEX "_lessons_v_version_version_level_idx" ON "payload"."_lessons_v" USING btree ("version_level");
  ALTER TABLE "payload"."lessons" DROP COLUMN "shuffle_exercises";
  ALTER TABLE "payload"."lessons" DROP COLUMN "version";
  ALTER TABLE "payload"."_lessons_v" DROP COLUMN "version_shuffle_exercises";
  ALTER TABLE "payload"."_lessons_v" DROP COLUMN "version_version";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."lessons_exercises" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v_version_exercises" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "payload"."lessons_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_lessons_v_version_steps" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."lessons_steps" CASCADE;
  DROP TABLE "payload"."_lessons_v_version_steps" CASCADE;
  DROP INDEX "payload"."lessons_level_idx";
  DROP INDEX "payload"."_lessons_v_version_version_level_idx";
  ALTER TABLE "payload"."lessons" ADD COLUMN "shuffle_exercises" boolean DEFAULT true;
  ALTER TABLE "payload"."lessons" ADD COLUMN "version" varchar;
  ALTER TABLE "payload"."_lessons_v" ADD COLUMN "version_shuffle_exercises" boolean DEFAULT true;
  ALTER TABLE "payload"."_lessons_v" ADD COLUMN "version_version" varchar;
  ALTER TABLE "payload"."lessons_exercises" ADD CONSTRAINT "lessons_exercises_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_version_exercises" ADD CONSTRAINT "_lessons_v_version_exercises_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "lessons_exercises_order_idx" ON "payload"."lessons_exercises" USING btree ("_order");
  CREATE INDEX "lessons_exercises_parent_id_idx" ON "payload"."lessons_exercises" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_version_exercises_order_idx" ON "payload"."_lessons_v_version_exercises" USING btree ("_order");
  CREATE INDEX "_lessons_v_version_exercises_parent_id_idx" ON "payload"."_lessons_v_version_exercises" USING btree ("_parent_id");
  ALTER TABLE "payload"."lessons" DROP COLUMN "level";
  ALTER TABLE "payload"."lessons" DROP COLUMN "part";
  ALTER TABLE "payload"."lessons" DROP COLUMN "shuffle_steps";
  ALTER TABLE "payload"."_lessons_v" DROP COLUMN "version_level";
  ALTER TABLE "payload"."_lessons_v" DROP COLUMN "version_part";
  ALTER TABLE "payload"."_lessons_v" DROP COLUMN "version_shuffle_steps";`)
}
