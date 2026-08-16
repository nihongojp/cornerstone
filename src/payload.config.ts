import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import { buildConfig } from "payload";

import { CmsAdmins } from "./payload/collections/CmsAdmins";
import { Courses } from "./payload/collections/Courses";
import { Lessons } from "./payload/collections/Lessons";
import { Media } from "./payload/collections/Media";
import { Resources } from "./payload/collections/Resources";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * Payload shares one Neon database with the app, separated by Postgres schema:
 * Payload owns `payload`, drizzle-kit owns `public`. Spike #10 proved the two
 * coexist, including a cross-schema foreign key from `public.user_progress`
 * to `payload.lessons(slug)`.
 *
 * Three settings here are load-bearing, all from that spike:
 *
 *  - `push: false`, unconditionally, dev included. One boot with `push: true`
 *    writes a `name='dev', batch=-1` row into `payload_migrations`, after which
 *    every `payload migrate` blocks on an interactive data-loss prompt — which
 *    in CI just hangs. Schema changes go through `npm run payload:migrate:create`.
 *  - The default serial `idType`. Nothing in `public` references a Payload
 *    document id (the FK targets `slug`, a natural key), so uuid buys nothing
 *    and changing it later retypes every id column.
 *  - Payload does not issue `CREATE SCHEMA`. `drizzle/0001_create_payload_schema.sql`
 *    does, which is why drizzle migrations must run before Payload's.
 */
export default buildConfig({
  admin: {
    user: CmsAdmins.slug,
    meta: { titleSuffix: "— Nihon-Go! CMS" },
  },
  collections: [Courses, Lessons, Resources, Media, CmsAdmins],
  db: postgresAdapter({
    schemaName: "payload",
    push: false,
    migrationDir: path.resolve(dirname, "payload/migrations"),
    pool: { connectionString: process.env.DATABASE_URL },
  }),
  secret: process.env.PAYLOAD_SECRET ?? "",
  typescript: {
    outputFile: path.resolve(dirname, "payload/payload-types.ts"),
  },
  // Payload 3 declares storage adapters as plugins; v4 moves them to a
  // top-level `storage` key. Do not follow v4 docs here — we are pinned to 3.x.
  plugins: [
    vercelBlobStorage({
      collections: { [Media.slug]: true },
      // Keeps the adapter's own fields in the schema even when the token is
      // absent, so a developer without Blob access generates the same
      // migrations as CI does.
      alwaysInsertFields: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
  sharp: undefined,
});
