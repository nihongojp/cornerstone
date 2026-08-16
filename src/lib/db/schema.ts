import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

/*
 * Port of server/src/models/UserProgress.ts.
 *
 * `lessonId` holds a lesson SLUG (not a database id) — that's what the Mongo
 * model stored and what both lesson players send.
 *
 * It carries a foreign key to `payload.lessons(slug)`, ON UPDATE CASCADE and
 * ON DELETE RESTRICT (#11, #21) — but you will not find it below. The target
 * is Payload's table in another schema, invisible to `schema.ts`, so the
 * constraint lives in a hand-written migration:
 * `drizzle/0002_user_progress_lesson_fk.sql`. `drizzle-kit generate` cannot
 * see it and will never re-emit it; `drizzle-kit push` would propose dropping
 * it, which is why there is no `db:push` script. Renaming a lesson slug
 * rewrites these rows automatically; deleting a lesson anyone has progress on
 * is refused.
 *
 * `stepKey` is a content-derived resume key. The grammar player reshuffles its
 * exercises on every visit (client/src/utils/expandLessonItems.ts), so a raw
 * step index would resume at the wrong exercise; the key identifies the item by
 * its content instead. It is opaque to the server — store and return verbatim.
 */
export const userProgress = pgTable(
  "user_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull(),
    status: text("status", { enum: ["in_progress", "completed"] })
      .notNull()
      .default("in_progress"),
    lastStep: integer("last_step").notNull().default(0),
    stepKey: text("step_key").notNull().default(""),
    accuracyPct: real("accuracy_pct").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_progress_user_lesson_uq").on(t.userId, t.lessonId)]
);

export type UserProgressRow = typeof userProgress.$inferSelect;
