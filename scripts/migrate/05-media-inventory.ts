/**
 * Inventory every media URL held in Payload content, grouped by host.
 *
 *   npx tsx scripts/migrate/05-media-inventory.ts > scripts/migrate/out/media-inventory.md
 *
 * Read-only. Written for the private-Blob migration: component media fields are
 * plain URL strings (see `src/payload/fields/media.ts`), so the only way to know
 * what still points at Cloudinary — and therefore what has to be transferred
 * into the Blob store — is to ask the database. The repo cannot tell you: the
 * only Cloudinary URLs committed anywhere are the ten hardcoded stroke-order
 * PNGs in `scripts/content/kana-stroke-order.ts` and the sample values quoted in
 * `out/items-audit.md`, which is a MongoDB-era artifact and not live data.
 *
 * Both the live block tables and the `_v_` draft-version mirrors are surveyed.
 * The mirrors matter because they hold their own copies of every media column,
 * so a rewrite that skips them leaves historical versions pointing at URLs that
 * may later stop resolving.
 */
import { config } from "dotenv";
import { Pool } from "pg";

// `quiet` keeps dotenv's banner off stdout — this script's stdout IS the report.
config({ path: ".env.local", quiet: true });

/*
 * Discovered from the schema rather than hardcoded. The block tables are named
 * after their Payload block, so a new block with a media field would otherwise
 * be silently missed by a fixed list — which is exactly the failure this
 * inventory exists to prevent.
 */
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
      OR (table_name IN ('resources_items', '_resources_v_version_items') AND column_name = 'url')
    )
  ORDER BY table_name, column_name
`;

type Column = { column_name: string; table_name: string };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.startsWith("/") ? "(payload-relative path)" : "(unparseable)";
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows: columns } = await pool.query<Column>(COLUMN_QUERY);

    type Row = { column: string; table: string; url: string };
    const values: Row[] = [];

    for (const { column_name, table_name } of columns) {
      const { rows } = await pool.query<{ url: string }>(
        `SELECT "${column_name}" AS url FROM payload."${table_name}"
         WHERE "${column_name}" IS NOT NULL AND "${column_name}" <> ''`,
      );
      for (const { url } of rows) {
        values.push({ column: column_name, table: table_name, url });
      }
    }

    const byHost = new Map<string, Row[]>();
    for (const row of values) {
      const host = hostOf(row.url);
      const bucket = byHost.get(host);
      if (bucket) {
        bucket.push(row);
      } else {
        byHost.set(host, [row]);
      }
    }

    const isVersion = (table: string) => table.startsWith("_") && table.includes("_v_");

    console.log("# Media inventory\n");
    console.log(`Columns surveyed: **${columns.length}**`);
    console.log(`Non-empty values: **${values.length}**`);
    console.log(`Distinct URLs: **${new Set(values.map((v) => v.url)).size}**\n`);

    console.log("## By host\n");
    console.log("| Host | Values | Distinct URLs | In live tables | In version mirrors |");
    console.log("| --- | ---: | ---: | ---: | ---: |");
    for (const [host, rows] of [...byHost.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const live = rows.filter((r) => !isVersion(r.table)).length;
      console.log(
        `| \`${host}\` | ${rows.length} | ${new Set(rows.map((r) => r.url)).size} | ${live} | ${rows.length - live} |`,
      );
    }

    /*
     * `resources_items.url` is a link to somebody else's website (NHK, Asahi,
     * Genki), not an asset we host — it shares a shape with media columns but
     * nothing about it should ever be transferred into our Blob store.
     */
    console.log("\n## Distinct URLs needing transfer (media columns only)\n");
    const mediaOnly = new Map<string, Row[]>();
    for (const [host, rows] of byHost) {
      const media = rows.filter((r) => r.column !== "url");
      if (media.length > 0) {
        mediaOnly.set(host, media);
      }
    }
    const external = [...mediaOnly.entries()].filter(
      ([host]) => host !== "(payload-relative path)" && !host.endsWith(".blob.vercel-storage.com"),
    );
    if (external.length === 0) {
      console.log("_None — every media URL is already Payload-served._");
    }
    for (const [host, rows] of external) {
      console.log(`### \`${host}\`\n`);
      const distinct = [...new Set(rows.map((r) => r.url))].sort();
      for (const url of distinct) {
        const where = rows.filter((r) => r.url === url);
        const liveWhere = where.filter((r) => !isVersion(r.table));
        console.log(
          `- \`${url}\`\n  - ${where.length} occurrence(s), ${liveWhere.length} live: ` +
            `${[...new Set(where.map((r) => `${r.table}.${r.column}`))].join(", ")}`,
        );
      }
      console.log("");
    }

    console.log("## Columns surveyed\n");
    for (const { column_name, table_name } of columns) {
      const n = values.filter((v) => v.table === table_name && v.column === column_name).length;
      console.log(`- \`payload.${table_name}.${column_name}\` — ${n} non-empty`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
