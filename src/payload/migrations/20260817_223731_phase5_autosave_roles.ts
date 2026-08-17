/*
 * Phase 5 — autosave retention and CMS roles.
 *
 * Two unrelated-looking changes in one migration because they are one release:
 *
 *   - `autosave` on the three version tables, from
 *     `versions: { drafts: { autosave: { interval: 375 } } }` in
 *     `payload/versions.ts`. Payload marks autosaved versions with it so the
 *     admin can tell them from deliberate saves. `maxPerDoc: 20` needs no
 *     column — it is enforced on write.
 *   - `cms_admins_roles`, from the new `roles` field. This is what
 *     `payload/access/isAdmin.ts` reads to gate every delete.
 *
 * The generated half of this file created the table and the column. The
 * backfill below is hand-written, because Payload does not generate one — see
 * the comment on it, which is the part of this migration worth reading.
 */
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_admins_roles" AS ENUM('admin', 'editor');
  CREATE TABLE "payload"."cms_admins_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_cms_admins_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );

  ALTER TABLE "payload"."_courses_v" ADD COLUMN "autosave" boolean;
  ALTER TABLE "payload"."_lessons_v" ADD COLUMN "autosave" boolean;
  ALTER TABLE "payload"."_resources_v" ADD COLUMN "autosave" boolean;
  ALTER TABLE "payload"."cms_admins_roles" ADD CONSTRAINT "cms_admins_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_admins_roles_order_idx" ON "payload"."cms_admins_roles" USING btree ("order");
  CREATE INDEX "cms_admins_roles_parent_idx" ON "payload"."cms_admins_roles" USING btree ("parent_id");
  CREATE INDEX "_courses_v_autosave_idx" ON "payload"."_courses_v" USING btree ("autosave");
  CREATE INDEX "_lessons_v_autosave_idx" ON "payload"."_lessons_v" USING btree ("autosave");
  CREATE INDEX "_resources_v_autosave_idx" ON "payload"."_resources_v" USING btree ("autosave");`)

  /*
   * Backfill every existing account as an admin.
   *
   * Payload creates the table empty and never generates a backfill, and the
   * field's own defaultValue only applies to documents written through Payload
   * from here on -- it does nothing for rows already in the database. So
   * without this, every existing account has zero roles the moment this runs.
   *
   * That is not a mild degradation, it is a lockout. isAdmin gates delete on
   * all six collections, and it also gates create/update/delete on cms_admins
   * itself, which is what stops an editor promoting themselves. With no admin
   * anywhere, nobody can delete anything and nobody can grant the role that
   * would fix it, because granting it needs update on cms_admins. The only way
   * back is SQL against production.
   *
   * "admin" rather than "editor" is also what keeps this migration honest about
   * what it changes. Before it, every authenticated CMS user could delete
   * everything -- that was the default Payload applied to an undeclared
   * operation. Backfilling admin preserves exactly that, so this migration
   * changes the *model* and not any individual's access. Narrowing who is an
   * admin is then a deliberate edit in the admin UI, visible and reversible,
   * rather than a side effect of a deploy.
   */
  await db.execute(sql`
  INSERT INTO "payload"."cms_admins_roles" ("order", "parent_id", "value")
  SELECT 1, a."id", 'admin'::"payload"."enum_cms_admins_roles"
    FROM "payload"."cms_admins" a;
  `)

  /*
   * Positive evidence that the backfill covered everyone, in the shape Phase 4b
   * settled on: ask whether any row is *missing* what it should have, rather
   * than trusting a count that was correct at the time it was written.
   *
   * An account with no role is the locked-out state described above, and it is
   * silent -- the admin UI renders normally and the Delete button simply
   * refuses. A failed migration rolls back atomically, so stopping here costs
   * nothing.
   */
  await db.execute(sql`
  DO $$
  DECLARE
    offenders text;
    n bigint;
  BEGIN
    SELECT count(*), string_agg(a.email, ', ' ORDER BY a.email)
      INTO n, offenders
      FROM "payload"."cms_admins" a
     WHERE NOT EXISTS (
       SELECT 1 FROM "payload"."cms_admins_roles" r WHERE r."parent_id" = a."id"
     );

    IF n > 0 THEN
      RAISE EXCEPTION
        'Phase 5: % CMS account(s) ended up with no role and would be locked out of deletes and account management: %.',
        n, offenders;
    END IF;
  END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  /*
   * No guard and no data rescue: dropping the table drops the roles, which is
   * correct, because the field they belong to is going with it. Access reverts
   * to what it was before Phase 5 -- any authenticated CMS user can delete
   * anything -- which is the state this migration was written to leave behind.
   */
  await db.execute(sql`
   ALTER TABLE "payload"."cms_admins_roles" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_admins_roles" CASCADE;
  DROP INDEX "payload"."_courses_v_autosave_idx";
  DROP INDEX "payload"."_lessons_v_autosave_idx";
  DROP INDEX "payload"."_resources_v_autosave_idx";
  ALTER TABLE "payload"."_courses_v" DROP COLUMN "autosave";
  ALTER TABLE "payload"."_lessons_v" DROP COLUMN "autosave";
  ALTER TABLE "payload"."_resources_v" DROP COLUMN "autosave";
  DROP TYPE "payload"."enum_cms_admins_roles";`)
}
