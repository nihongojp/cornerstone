import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Payload owns the `payload` schema in the same database (spike #10).
  // `public` is already the default; naming it makes the boundary explicit and
  // keeps drizzle-kit from ever diffing Payload's tables.
  //
  // There is deliberately no `db:push` script: `drizzle-kit push` diffs against
  // the live database rather than the snapshot, so it would see the
  // hand-written cross-schema FK from `public.user_progress` to
  // `payload.lessons(slug)` — which is absent from `schema.ts` — and propose
  // dropping it. Schema changes go through generate + migrate.
  schemaFilter: ["public"],
});
