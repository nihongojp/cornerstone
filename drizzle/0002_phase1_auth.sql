CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint
/*
 * Hand-added: `drizzle-kit generate` changes the DEFAULT for future rows and
 * leaves existing ones alone, so without this every account created before this
 * migration keeps the Mongoose-era value forever.
 *
 * Backfilled to `member`, not `user`: these are registered accounts, and
 * `member` is the registered tier. The errors are not symmetric — if `member`
 * later gates something and these rows say `user`, existing people silently
 * lose access and we find out by support email; the reverse is one UPDATE and
 * harms nobody in the meantime, since no route gates on role at all today. The
 * population is also small and known to be fake or internal-team.
 */
UPDATE "user" SET "role" = 'member' WHERE "role" = 'Volunteer' OR "role" IS NULL;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");