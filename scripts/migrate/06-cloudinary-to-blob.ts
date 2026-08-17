/**
 * Move every Cloudinary-hosted asset into the private Vercel Blob store and
 * repoint the content at Payload's gated media route.
 *
 *   node --import tsx/esm scripts/migrate/06-cloudinary-to-blob.ts --dry-run
 *   node --import tsx/esm scripts/migrate/06-cloudinary-to-blob.ts
 *
 * Idempotent and resumable: assets already in the `media` collection are reused
 * rather than re-uploaded, and URLs already rewritten no longer match. Run it
 * against `development` first, then against `production` — the Blob store is
 * shared, so the second run uploads nothing and only rewrites URLs.
 *
 * Why it exists. Course media was public on Cloudinary while the Blob store is
 * private, so gating uploads without moving the back catalogue would have
 * protected only new files and left every existing lesson asset world-readable.
 *
 * Two placeholders are deliberately NOT transferred — Cloudinary's `demo` cloud
 * `sample.jpg` and `dummy_audio.mp3`. They are stand-ins, not content, and the
 * codebase already has a convention for this: `cleanMediaUrl`/`isPlaceholderUrl`
 * drop `PLACEHOLDER_*` sentinels to empty at import so an unfilled slot reads as
 * unfilled rather than as a broken asset. These two are the same category, so
 * they are nulled instead of being baked into our own store.
 *
 * On the rewrite itself: it is a targeted per-column SQL update, not a
 * whole-document `payload.update`. Round-tripping documents would risk
 * disturbing the flashcard deck's `audio[]` array, which is index-coupled to
 * `cards[]` (see `src/lib/content/adapters.ts`) — replacing one column's exact
 * string cannot reorder or drop anything. It also reaches the `_v_` draft
 * mirrors, which hold the large majority of occurrences and which the Payload
 * API will not rewrite for you.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

import type { Payload } from "payload";

const DRY_RUN = process.argv.includes("--dry-run");

/*
 * Stroke-order images are compiled into the bundle rather than stored in the
 * database (`scripts/content/kana-stroke-order.ts`), so no query finds them — they need
 * their own pass or they stay on Cloudinary while everything else moves.
 *
 * The list is a hardcoded constant rather than something scraped out of the
 * file, and that is the load-bearing detail: after the first run the file no
 * longer mentions Cloudinary, so a file-driven pass would do nothing on the
 * second database and production would end up with source referencing media
 * rows it never got. Driving from a fixed list keeps `ensureMediaDoc` running
 * per-database while the rewrite itself is naturally idempotent.
 */
const SOURCE_ASSET_URLS = [
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657160/Screenshot_2026-08-13_at_2.38.01_PM_ei0pad.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657160/Screenshot_2026-08-13_at_2.38.07_PM_hhpoil.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657160/Screenshot_2026-08-13_at_2.38.15_PM_s4uuwp.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657160/Screenshot_2026-08-13_at_2.38.19_PM_pim0ml.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.23_PM_qd5ypr.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.30_PM_uljbn3.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.33_PM_n6m4pf.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.37_PM_etzwyb.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.40_PM_aryuah.png",
  "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.43_PM_cd7s34.png",
] as const;

const SOURCE_ASSET_FILE = "scripts/content/kana-stroke-order.ts";

/*
 * Not content. Nulled rather than transferred — see the header. Matched on the
 * full URL so a real asset that merely shares a filename is unaffected.
 */
const PLACEHOLDER_URLS = new Set([
  "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  "https://res.cloudinary.com/dxxezusx5/video/upload/v1778114881/dummy_audio.mp3",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  png: "image/png",
  webm: "video/webm",
};

const COLUMN_QUERY = `
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'payload'
    AND data_type IN ('character varying', 'text')
    AND (
      column_name LIKE '%audio_url%'
      OR column_name LIKE '%image_url%'
      OR column_name LIKE '%video_url%'
      OR column_name = 'image'
    )
  ORDER BY table_name, column_name
`;

type Column = { column_name: string; table_name: string };

/**
 * Cloudinary's basename already carries its own uniqueness suffix
 * (`Hajimemashite_cqfhtl.mp4`), so it doubles as a stable, collision-free key —
 * which is what makes re-running this script a no-op rather than a duplicate.
 */
function filenameFor(url: string): string {
  const path = new URL(url).pathname;
  return decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
}

function mimeFor(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const mime = MIME_BY_EXTENSION[ext];
  if (!mime) {
    throw new Error(`No MIME type mapped for "${filename}" — add it to MIME_BY_EXTENSION`);
  }
  return mime;
}

async function collectCloudinaryUrls(pool: Pool, columns: Column[]): Promise<Set<string>> {
  const urls = new Set<string>();
  for (const { column_name, table_name } of columns) {
    const { rows } = await pool.query<{ url: string }>(
      `SELECT DISTINCT "${column_name}" AS url FROM payload."${table_name}"
       WHERE "${column_name}" LIKE 'https://res.cloudinary.com/%'`,
    );
    for (const { url } of rows) {
      urls.add(url);
    }
  }
  return urls;
}

/** Uploads through Payload so filename, prefix and `url` all stay consistent
 *  with anything uploaded via the admin. Returns the gated media URL. */
async function ensureMediaDoc(payload: Payload, sourceUrl: string): Promise<string> {
  const filename = filenameFor(sourceUrl);

  const existing = await payload.find({
    collection: "media",
    where: { filename: { equals: filename } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });
  if (existing.docs.length > 0) {
    const url = (existing.docs[0] as { url?: string }).url;
    if (!url) {
      throw new Error(`Existing media doc for ${filename} has no url`);
    }
    return url;
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`GET ${sourceUrl} failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  const created = await payload.create({
    collection: "media",
    data: {
      alt: "",
      caption: "Migrated from Cloudinary",
    },
    file: {
      data: buffer,
      mimetype: mimeFor(filename),
      name: filename,
      size: buffer.byteLength,
    },
    depth: 0,
    overrideAccess: true,
  });

  const url = (created as { url?: string }).url;
  if (!url) {
    throw new Error(`Created media doc for ${filename} has no url`);
  }
  return url;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN && !DRY_RUN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set — without it uploads land on local disk, not the Blob store",
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { getPayload } = await import("payload");
  const { default: configPromise } = await import("../../src/payload.config");
  const payload = await getPayload({ config: configPromise });

  try {
    const { rows: columns } = await pool.query<Column>(COLUMN_QUERY);
    const urls = [...(await collectCloudinaryUrls(pool, columns))].sort();

    const placeholders = urls.filter((u) => PLACEHOLDER_URLS.has(u));
    const transferable = urls.filter((u) => !PLACEHOLDER_URLS.has(u));

    console.log(`Columns:       ${columns.length}`);
    console.log(`Cloudinary:    ${urls.length} distinct`);
    console.log(`  transfer:    ${transferable.length}`);
    console.log(`  placeholder: ${placeholders.length} (will be set NULL)`);
    console.log(DRY_RUN ? "\nDRY RUN — nothing will be written\n" : "");

    // ── 1. assets ──────────────────────────────────────────────────────────
    const replacement = new Map<string, string | null>();
    for (const url of placeholders) {
      replacement.set(url, null);
    }

    for (const url of transferable) {
      if (DRY_RUN) {
        console.log(`  would transfer ${filenameFor(url)}`);
        continue;
      }
      const mediaUrl = await ensureMediaDoc(payload, url);
      replacement.set(url, mediaUrl);
      console.log(`  ${filenameFor(url)} → ${mediaUrl}`);
    }

    if (DRY_RUN) {
      for (const url of placeholders) {
        console.log(`  would NULL ${filenameFor(url)}`);
      }
      const source = readFileSync(resolve(process.cwd(), SOURCE_ASSET_FILE), "utf8");
      const pending = SOURCE_ASSET_URLS.filter((u) => source.includes(u)).length;
      console.log(
        `  would ensure ${SOURCE_ASSET_URLS.length} stroke-order media doc(s), ` +
          `rewriting ${pending} URL(s) in ${SOURCE_ASSET_FILE}`,
      );
      return;
    }

    // ── 2. content ─────────────────────────────────────────────────────────
    console.log("\nRewriting content…");
    let updated = 0;
    for (const { column_name, table_name } of columns) {
      for (const [from, to] of replacement) {
        const result = await pool.query(
          `UPDATE payload."${table_name}" SET "${column_name}" = $1 WHERE "${column_name}" = $2`,
          [to, from],
        );
        if (result.rowCount) {
          updated += result.rowCount;
        }
      }
    }
    console.log(`Rows updated: ${updated}`);

    // ── 3. proof ───────────────────────────────────────────────────────────
    let remaining = 0;
    for (const { column_name, table_name } of columns) {
      const { rows } = await pool.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM payload."${table_name}"
         WHERE "${column_name}" LIKE 'https://res.cloudinary.com/%'`,
      );
      remaining += Number(rows[0].n);
    }
    console.log(`Cloudinary URLs remaining: ${remaining}`);
    if (remaining > 0) {
      throw new Error("Cloudinary URLs still present after rewrite");
    }

    // ── 4. bundled source assets ───────────────────────────────────────────
    console.log("\nStroke-order images (compiled into the bundle)…");
    const sourcePath = resolve(process.cwd(), SOURCE_ASSET_FILE);
    let source = readFileSync(sourcePath, "utf8");
    let rewritten = 0;

    for (const url of SOURCE_ASSET_URLS) {
      const mediaUrl = await ensureMediaDoc(payload, url);
      if (source.includes(url)) {
        source = source.split(url).join(mediaUrl);
        rewritten += 1;
      }
    }

    if (rewritten > 0) {
      writeFileSync(sourcePath, source);
    }
    console.log(
      `  ${SOURCE_ASSET_URLS.length} media docs ensured, ${rewritten} URL(s) rewritten in ${SOURCE_ASSET_FILE}`,
    );
    if (source.includes("res.cloudinary.com")) {
      throw new Error(`Cloudinary URLs still present in ${SOURCE_ASSET_FILE}`);
    }
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
