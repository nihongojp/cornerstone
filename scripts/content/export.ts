import { config } from "dotenv";

/*
 * Payload → JSON. The content snapshot (Phase 0b).
 *
 *   npm run content:export
 *
 * Read-only. Writes `content/snapshot/` — one file per collection, plus a
 * manifest and a quarantine report.
 *
 * Why this exists: MongoDB, the original source, is decommissioned on
 * 2026-09-15, and every phase after this one restructures the block schema.
 * `payload migrate:create` generates the ADD and the DROP for a column but
 * never the data movement in between, and every statement has to be repeated
 * against the `_lessons_v_blocks_*` version mirrors, which hold more rows than
 * the live tables. With a snapshot, a schema change is a JSON transform and a
 * re-import instead. Without one, it is hand-written SQL across 17 block
 * tables and their mirrors.
 *
 * Fail-loud, in the house style: a reference that cannot be made portable
 * (see `lib/snapshot.ts`) is a non-zero exit, not a warning. A snapshot that
 * silently dropped a relationship would be worse than no snapshot, because it
 * would be trusted.
 *
 * Loads `.env.local` before importing the Payload config, which reads
 * PAYLOAD_SECRET at module scope.
 */

config({ path: ".env.local" });

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  CONTENT_COLLECTIONS,
  keyOf,
  toPortable,
  type BrokenRef,
  type Manifest,
  type MediaRecord,
  type SnapshotDoc,
} from "./lib/snapshot";

const OUT_DIR = path.resolve("content/snapshot");

/*
 * Deep enough to populate every relationship the walker needs to rewrite.
 * Today the deepest chain is lesson → course (1). Phase 1 adds block → media
 * (2) and Phase 2 adds block → term → media (3). Export runs once by hand, so
 * there is nothing to win by trimming this.
 */
const EXPORT_DEPTH = 5;

type Quarantine = {
  takenAt: string;
  note: string;
  legacyJson: Array<{ lesson: string; exercise: number; originalType: string; data: unknown }>;
  placeholders: Array<{ lesson: string; exercise: number; field: string; value: string }>;
};

const PLACEHOLDER = /placeholder/i;

function payloadVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    return pkg.dependencies?.payload ?? "(unknown)";
  } catch {
    return "(unknown)";
  }
}

function gitSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "(unknown)";
  }
}

/*
 * Two things worth a human decision, collected while walking the exercises.
 *
 * This is a *report*, not a filter: everything listed here is still in the
 * snapshot and still round-trips. Phase 4 is where `legacyJson` rows are
 * re-authored or deleted, and that conversation needs the list first.
 */
function scanForQuarantine(lessons: SnapshotDoc[], q: Quarantine): void {
  for (const lesson of lessons) {
    const exercises = (lesson.latest.exercises ?? []) as Array<Record<string, unknown>>;
    if (!Array.isArray(exercises)) continue;

    exercises.forEach((exercise, index) => {
      const components = (exercise?.components ?? []) as Array<Record<string, unknown>>;
      if (!Array.isArray(components)) return;

      for (const block of components) {
        if (block?.blockType === "legacyJson") {
          q.legacyJson.push({
            lesson: lesson.key,
            exercise: index,
            originalType: String(block.originalType ?? "(unknown)"),
            data: block.data,
          });
        }
        /*
         * Any field, not just media. The import dropped placeholder *URLs* to
         * empty, but placeholder *copy* came through verbatim — l1-v2 ships
         * "PLACEHOLDER_PHRASE_SAN" to learners as an exercise phrase. Same
         * sentinel convention, different failure, and only the second kind is
         * still visible on the site.
         */
        for (const [field, value] of Object.entries(block ?? {})) {
          if (typeof value === "string" && PLACEHOLDER.test(value)) {
            q.placeholders.push({ lesson: lesson.key, exercise: index, field, value });
          }
        }
      }
    });
  }
}

async function main() {
  const { getPayload } = await import("payload");
  const { default: configPromise } = await import("../../src/payload.config");
  const payload = await getPayload({ config: configPromise });

  console.log(`\nExporting Payload content → ${path.relative(process.cwd(), OUT_DIR)}\n`);

  const broken: BrokenRef[] = [];
  const snapshot: Record<string, SnapshotDoc[]> = {};
  const counts: Record<string, number> = {};

  for (const collection of CONTENT_COLLECTIONS) {
    /*
     * Whether this collection has a draft/publish cycle at all. `terms` does
     * not — see the note on its collection config — and querying `_status` on a
     * collection without versions is a 400, not an empty result.
     */
    const hasDrafts = Boolean(payload.collections[collection]?.config.versions?.drafts);

    /*
     * Two reads for a collection with drafts. `draft: true` returns the latest
     * saved state, which for a document with unpublished edits is not what the
     * site serves; the second read gets the published version so both survive
     * the round trip. Anything older than those two is not preserved — see
     * lib/snapshot.
     */
    const latest = await payload.find({
      collection,
      depth: EXPORT_DEPTH,
      ...(hasDrafts ? { draft: true } : {}),
      limit: 0,
      pagination: false,
      overrideAccess: true,
      sort: "createdAt",
    });

    const published = hasDrafts
      ? await payload.find({
          collection,
          depth: EXPORT_DEPTH,
          where: { _status: { equals: "published" } },
          limit: 0,
          pagination: false,
          overrideAccess: true,
          sort: "createdAt",
        })
      : { docs: [] as typeof latest.docs };

    const publishedById = new Map(published.docs.map((doc) => [doc.id, doc]));
    const seen = new Map<string, string>();
    const docs: SnapshotDoc[] = [];

    for (const doc of latest.docs) {
      const record = doc as unknown as Record<string, unknown>;
      const key = keyOf(collection, record);
      if (!key) {
        broken.push({
          collection,
          doc: String(record.id),
          field: "(natural key)",
          detail: "no slug/sourceId/category to identify this document across databases",
        });
        continue;
      }
      if (seen.has(key)) {
        broken.push({
          collection,
          doc: key,
          field: "(natural key)",
          detail: `key collides with document id ${seen.get(key)} — keys must be unique to import`,
        });
        continue;
      }
      seen.set(key, String(record.id));

      const entry: SnapshotDoc = {
        key,
        status: String(record._status ?? "published"),
        latest: toPortable(payload, collection, record, broken),
      };

      const publishedDoc = publishedById.get(doc.id);
      if (publishedDoc && record._status === "draft") {
        entry.published = toPortable(
          payload,
          collection,
          publishedDoc as unknown as Record<string, unknown>,
          broken
        );
      }

      docs.push(entry);
    }

    snapshot[collection] = docs;
    counts[collection] = docs.length;
    const withDrafts = docs.filter((d) => d.published).length;
    console.log(
      `  ${collection.padEnd(10)} ${String(docs.length).padStart(4)} docs` +
        (withDrafts ? `  (${withDrafts} with unpublished edits on top)` : "")
    );
  }

  // Media metadata. Bytes stay in Blob; this is what an import verifies against.
  const media = await payload.find({
    collection: "media",
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    sort: "filename",
  });

  const mediaRecords: MediaRecord[] = media.docs.map((doc) => {
    const m = doc as unknown as Record<string, unknown>;
    return {
      filename: String(m.filename ?? ""),
      alt: (m.alt as string) ?? null,
      caption: (m.caption as string) ?? null,
      mimeType: (m.mimeType as string) ?? null,
      filesize: (m.filesize as number) ?? null,
      width: (m.width as number) ?? null,
      height: (m.height as number) ?? null,
    };
  });
  counts.media = mediaRecords.length;
  console.log(`  ${"media".padEnd(10)} ${String(mediaRecords.length).padStart(4)} files (metadata only)`);

  if (broken.length) {
    console.error("\n✗ References that cannot be made portable — nothing was written:\n");
    for (const b of broken) {
      console.error(`    ${b.collection}/${b.doc}  ${b.field}`);
      console.error(`      ${b.detail}`);
    }
    console.error(
      "\n  A snapshot holding a raw document id is not portable. Fix the data, or raise\n" +
        "  EXPORT_DEPTH if a relationship came back unpopulated.\n"
    );
    process.exit(1);
  }

  const quarantine: Quarantine = {
    takenAt: new Date().toISOString(),
    note:
      "Content that needs a human decision. Everything listed here is STILL IN THE " +
      "SNAPSHOT and still round-trips — this is a to-do list, not a removal log. " +
      "legacyJson blocks have never rendered (adapters.ts drops them); Phase 4 " +
      "re-authors or deletes each one. placeholders are unfinished copy that IS " +
      "on the site right now — a learner sees the sentinel string.",
    legacyJson: [],
    placeholders: [],
  };
  scanForQuarantine(snapshot.lessons ?? [], quarantine);

  const manifest: Manifest = {
    takenAt: new Date().toISOString(),
    gitSha: gitSha(),
    // From our own package.json rather than payload's: every @payloadcms/*
    // dependency is pinned exact, so this is the version that is installed.
    payloadVersion: payloadVersion(),
    counts,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const write = (name: string, data: unknown) =>
    writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`);

  for (const collection of CONTENT_COLLECTIONS) write(`${collection}.json`, snapshot[collection]);
  write("media.json", mediaRecords);
  write("manifest.json", manifest);
  writeFileSync(
    path.resolve("content/quarantine.json"),
    `${JSON.stringify(quarantine, null, 2)}\n`
  );

  console.log(`\n✓ snapshot written (git ${manifest.gitSha.slice(0, 8)}, payload ${manifest.payloadVersion})`);
  if (quarantine.legacyJson.length || quarantine.placeholders.length) {
    console.log(
      `\n  content/quarantine.json: ${quarantine.legacyJson.length} legacyJson block(s), ` +
        `${quarantine.placeholders.length} unfinished placeholder string(s) — for the review pass, not a failure.`
    );
  }
  console.log();

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
