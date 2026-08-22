import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";
import sharp from "sharp";

import { vercelPrivateBlobStorage } from "./payload/storage/vercelPrivateBlob";
import { livePreviewURL } from "./payload/preview";
import { proseEditor } from "./payload/fields/prose";

import { CmsAdmins } from "./payload/collections/CmsAdmins";
import { Courses } from "./payload/collections/Courses";
import { Lessons } from "./payload/collections/Lessons";
import { Media } from "./payload/collections/Media";
import { Resources } from "./payload/collections/Resources";
import { Terms } from "./payload/collections/Terms";
import { pinSslMode } from "./lib/db/connection";

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
    /*
     * Where a component path like `/payload/blocks/BlockRowLabel#BlockRowLabel`
     * is resolved from. Payload defaults this to `process.cwd()`, which would
     * make every path start with `/src` — stating it once here keeps the paths in
     * the collection configs short and makes it obvious they are repo-relative
     * rather than package specifiers.
     *
     * Changing which components exist means regenerating the map:
     * `npm run payload:importmap`. It is not a migration and it is easy to
     * forget — `39f1e3f` had to fix a stale one by hand.
     */
    importMap: { baseDir: path.resolve(dirname) },
    /*
     * Live Preview renders the real front end in a panel beside the editing
     * form and pushes the unsaved form state into it over `postMessage`, so an
     * editor sees a lesson as a learner would while they are still typing it.
     *
     * `url` points at /api/preview, not at the page: Draft Mode is a cookie
     * only a route handler can set, and that handler is where the request is
     * checked. See `payload/preview.ts` for what goes into the URL and
     * `app/(app)/api/preview/route.ts` for what happens to it.
     */
    livePreview: {
      url: livePreviewURL,
      // Only the two collections with a page of their own. A course is a
      // grouping with no route, and media is an upload — there is nothing for
      // the iframe to load in either case.
      collections: [Lessons.slug, Resources.slug],
      // Payload adds "responsive" itself; these are the fixed sizes to check a
      // lesson against, and the phone is the one that matters most here.
      breakpoints: [
        { name: "mobile", label: "Mobile", width: 390, height: 844 },
        { name: "tablet", label: "Tablet", width: 768, height: 1024 },
        { name: "desktop", label: "Desktop", width: 1440, height: 900 },
      ],
    },
  },
  // CmsAdmins is `admin.user` above — leaving it out of this list points the
  // admin panel at a collection that was never registered, which takes out
  // /admin login and `npm run payload:seed-admins` with it.
  collections: [Courses, Lessons, Terms, Resources, Media, CmsAdmins],
  /*
   * The root editor. A `richText` field that names no `editor` of its own
   * inherits this one, which is the point: the nine prose fields converted in
   * Phase 3, and every one added after, get the same toolbar and the same
   * blocks without anyone wiring it up per field. See `payload/fields/prose.ts`
   * for what is in it and why furigana is two inline blocks rather than a
   * custom Lexical node.
   *
   * Adding a Lexical feature or block changes which client components the admin
   * panel needs, so it needs `npm run payload:importmap` — not a migration.
   */
  editor: proseEditor,
  db: postgresAdapter({
    schemaName: "payload",
    push: false,
    migrationDir: path.resolve(dirname, "payload/migrations"),
    pool: {
      connectionString: process.env.DATABASE_URL
        ? pinSslMode(process.env.DATABASE_URL)
        : process.env.DATABASE_URL,
    },
  }),
  secret: process.env.PAYLOAD_SECRET ?? "",
  typescript: {
    outputFile: path.resolve(dirname, "payload/payload-types.ts"),
  },
  // Payload 3 declares storage adapters as plugins; v4 moves them to a
  // top-level `storage` key. Do not follow v4 docs here — we are pinned to 3.x.
  //
  // Our own adapter, not `@payloadcms/storage-vercel-blob`: the Blob store is
  // private and that package can only speak `access: 'public'`. See
  // `payload/storage/vercelPrivateBlob.ts` for the whole story.
  plugins: [
    vercelPrivateBlobStorage({
      collections: { [Media.slug]: true },
      // Keeps the adapter's own fields in the schema even when the token is
      // absent, so a developer without Blob access generates the same
      // migrations as CI does.
      alwaysInsertFields: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
  /*
   * Payload does no image processing without this — no `imageSizes`, no
   * `adminThumbnail`, so every Media row rendered as a bare id and every
   * `<img>` on the site downloaded the full-resolution original. `withPayload`
   * already lists sharp in `serverExternalPackages`, so it needs nothing in
   * next.config.ts.
   */
  sharp,
});
