import {
  pgTable,
  text,
  timestamp,
  boolean,
  bigint,
  integer,
  index,
} from "drizzle-orm/pg-core";

/*
 * Better Auth's core tables. Table/column names follow Better Auth's expected
 * defaults — the Drizzle adapter maps its internal models onto these by name,
 * so renaming anything here requires a matching `schema` mapping in auth.ts.
 *
 * `firstName`/`lastName`/`role` are additionalFields declared in auth.ts; they
 * carry over the shape of the old Mongoose User model (server/src/models/user.ts)
 * so migrated accounts keep their data.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  /*
   * `admin` / `member` / `user` — administrator, registered learner, and the
   * unentitled tier. See CONTEXT.md.
   *
   * Renamed from the Mongoose-era `Volunteer` in #55. It was safe to do then
   * and is not now: the audit for #50 confirmed `role` gated nothing anywhere,
   * so changing the values was behaviourally a no-op — which stopped being
   * true the moment Phase 1 began creating accounts through Google, magic link
   * and OTP. Nothing reads it yet; #56 decides what it is allowed to do.
   */
  role: text("role").default("user"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

/*
 * The three indexes below are the ones Better Auth declares `index: true` on
 * in its own table definition (`@better-auth/core/dist/db/get-tables.mjs`) and
 * that this hand-written Drizzle schema never carried. They were harmless while
 * the only auth path was email + password; #49 found them missing, and Phase 1
 * is what makes them matter.
 */
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    // For the "credential" provider this holds the password hash, always
    // Better Auth's native scrypt.
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  /*
   * The hottest lookup in the app once magic link and email OTP are live —
   * every link click and every code entry reads this table by identifier, and
   * without the index each one is a sequential scan.
   */
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

/*
 * Better Auth's rate-limit store. Its default is an in-process Map, which on
 * Vercel means the real ceiling is `max` × live-instance-count and a cold start
 * resets it — so the limits standing in front of the mail-send endpoints were
 * decorative (#49). Setting `rateLimit.storage: "database"` in auth.ts points
 * it here instead.
 *
 * Column names and types come from Better Auth's own table definition
 * (`@better-auth/core/dist/db/get-tables.mjs`): `lastRequest` is declared
 * `bigint`, so it is one here too — it stores `Date.now()`, which overflows a
 * 32-bit integer.
 */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
