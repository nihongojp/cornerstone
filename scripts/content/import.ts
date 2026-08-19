import { config } from "dotenv";

/*
 * JSON → Payload. The other half of the content snapshot (Phase 0b).
 *
 *   npm run content:import               # dry run: says what it would do
 *   npm run content:import -- --yes      # upsert by natural key
 *   npm run content:import -- --wipe --yes
 *
 * Dry run by default, on purpose. This is the script that can empty the
 * content tables, and the cost of an accidental run is measured in Sachi's
 * authoring hours. `--yes` is the only thing that makes it write.
 *
 * Idempotent: documents upsert on their natural key (slug, or sourceId
 * falling back to category for resources), so re-running produces no
 * duplicates. `--wipe` is for the round-trip test — export, wipe a throwaway
 * Neon branch, import, `npm run parity` — which is the regression test for
 * every phase that re-imports rather than migrating.
 *
 * Media is never created or deleted here. The Blob store is durable on its own
 * and the bytes are not in the snapshot; what this does instead is check that
 * every file the snapshot references already exists in the target, and refuse
 * to run when one does not. An import that silently produced dangling media
 * would look like it worked.
 *
 * Import order is courses → lessons → resources, because a lesson references a
 * course by slug and the id it resolves to only exists once the course is in.
 */

config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import path from "node:path";

import type { Payload, Where } from "payload";

import {
  CONTENT_COLLECTIONS,
  NATURAL_KEY,
  fromPortable,
  referencedMediaFilenames,
  type BrokenRef,
  type ContentCollection,
  type Manifest,
  type SnapshotDoc,
} from "./lib/snapshot";

const IN_DIR = path.resolve("content/snapshot");

const args = new Set(process.argv.slice(2));
const WRITE = args.has("--yes");
const WIPE = args.has("--wipe");

function read<T>(name: string): T {
  try {
    return JSON.parse(readFileSync(path.join(IN_DIR, name), "utf8")) as T;
  } catch (err) {
    console.error(`\n✗ cannot read ${path.relative(process.cwd(), path.join(IN_DIR, name))}`);
    console.error("  Run `npm run content:export` first.\n");
    throw err;
  }
}

/** Host only — the connection string carries credentials. */
function targetHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL not set)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("\n✗ refusing to run with NODE_ENV=production.\n");
    process.exit(1);
  }

  const manifest = read<Manifest>("manifest.json");
  const snapshot = Object.fromEntries(
    CONTENT_COLLECTIONS.map((c) => [c, read<SnapshotDoc[]>(`${c}.json`)])
  ) as Record<ContentCollection, SnapshotDoc[]>;

  const { getPayload } = await import("payload");
  const { default: configPromise } = await import("../../src/payload.config");
  const payload = await getPayload({ config: configPromise });

  console.log(`\nImporting content/snapshot → ${targetHost()}`);
  console.log(
    `  snapshot taken ${manifest.takenAt} at git ${manifest.gitSha.slice(0, 8)} (payload ${manifest.payloadVersion})`
  );
  console.log(`  mode: ${WRITE ? (WIPE ? "WIPE AND IMPORT" : "upsert") : "dry run (no --yes)"}\n`);

  // ── What is there now ───────────────────────────────────────────────────────
  console.log("Target before:");
  for (const collection of CONTENT_COLLECTIONS) {
    const { totalDocs } = await payload.count({ collection, overrideAccess: true });
    console.log(
      `  ${collection.padEnd(10)} ${String(totalDocs).padStart(4)} → ${String(snapshot[collection].length).padStart(4)} in snapshot`
    );
  }

  // ── Media presence ──────────────────────────────────────────────────────────
  const media = await payload.find({
    collection: "media",
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
  });
  const mediaByFilename = new Map<string, number>();
  for (const doc of media.docs) {
    const filename = (doc as unknown as Record<string, unknown>).filename;
    if (typeof filename === "string") mediaByFilename.set(filename, doc.id as number);
  }

  const referenced = referencedMediaFilenames(CONTENT_COLLECTIONS.flatMap((c) => snapshot[c]));
  const missingMedia = [...referenced].filter((f) => !mediaByFilename.has(f)).sort();
  if (missingMedia.length) {
    console.error(
      `\n✗ the snapshot references ${missingMedia.length} media file(s) this database does not have:\n`
    );
    for (const f of missingMedia.slice(0, 20)) console.error(`    ${f}`);
    if (missingMedia.length > 20) console.error(`    … and ${missingMedia.length - 20} more`);
    console.error(
      "\n  Media bytes are not in the snapshot by design — they live in the Blob store.\n" +
        "  Point at a database whose media catalogue matches, or re-upload the files first.\n"
    );
    process.exit(1);
  }
  if (referenced.size) console.log(`\n✓ all ${referenced.size} referenced media file(s) present`);

  // ── Resolve every reference before writing anything ─────────────────────────
  /*
   * Two passes. The first resolves against the ids that will exist *after* the
   * import, which is why the lookup table is seeded from the snapshot's own
   * keys rather than the database: a lesson pointing at a course that is in
   * the snapshot is fine even on a wiped database. Anything still unresolved
   * here is genuinely dangling, and stops the run before a single write.
   */
  const lookup = new Map<string, Map<string, number>>();
  lookup.set("media", mediaByFilename);
  for (const collection of CONTENT_COLLECTIONS) {
    // Placeholder ids; replaced with real ones as each collection is written.
    lookup.set(collection, new Map(snapshot[collection].map((d, i) => [d.key, -(i + 1)])));
  }

  const unresolved: BrokenRef[] = [];
  for (const collection of CONTENT_COLLECTIONS) {
    for (const doc of snapshot[collection]) {
      fromPortable(payload, collection, doc.latest, lookup, unresolved);
      if (doc.published) fromPortable(payload, collection, doc.published, lookup, unresolved);
    }
  }
  if (unresolved.length) {
    console.error("\n✗ dangling references — nothing was written:\n");
    for (const u of unresolved) {
      console.error(`    ${u.collection}/${u.doc}  ${u.field}`);
      console.error(`      ${u.detail}`);
    }
    console.error();
    process.exit(1);
  }
  console.log("✓ every reference resolves");

  if (!WRITE) {
    console.log("\nDry run — nothing written. Re-run with --yes to apply.\n");
    process.exit(0);
  }

  // ── Wipe ────────────────────────────────────────────────────────────────────
  if (WIPE) {
    // Reverse order: a lesson references a course, so lessons go first.
    for (const collection of [...CONTENT_COLLECTIONS].reverse()) {
      const { totalDocs } = await payload.count({ collection, overrideAccess: true });
      if (!totalDocs) continue;
      console.log(`Deleting ${totalDocs} ${collection}…`);

      /*
       * A bulk delete does NOT throw when individual documents fail — it
       * collects them into `errors` and resolves. Ignoring that turns a
       * refused delete into a silent no-op, and the import then "succeeds" by
       * updating the rows it believed it had removed. The count check after it
       * is the belt: `errors` is Payload's report, `totalDocs` is the truth.
       */
      const result = await payload.delete({ collection, where: {}, overrideAccess: true });
      const errors = (result as { errors?: Array<{ message?: string; id?: unknown }> }).errors ?? [];
      const remaining = (await payload.count({ collection, overrideAccess: true })).totalDocs;

      if (errors.length || remaining) {
        console.error(`\n✗ could not wipe ${collection} — ${remaining} document(s) remain:\n`);
        for (const e of errors.slice(0, 10)) {
          console.error(`    ${String(e.id ?? "?")}: ${e.message ?? "(no message)"}`);
        }
        if (errors.length > 10) console.error(`    … and ${errors.length - 10} more`);
        console.error(
          "\n  A refused lesson delete is almost always the ON DELETE RESTRICT foreign key\n" +
            "  from public.user_progress.lesson_id (see guardLessonDelete): somebody has\n" +
            "  progress on that lesson. That is the constraint working — this database is\n" +
            "  not a throwaway. Check which one DATABASE_URL points at, or clear\n" +
            "  user_progress on the throwaway first.\n"
        );
        process.exit(1);
      }
    }
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  for (const collection of CONTENT_COLLECTIONS) {
    const ids = new Map<string, number>();
    let created = 0;
    let updated = 0;

    for (const entry of snapshot[collection]) {
      const existing = await findExisting(payload, collection, entry);

      /*
       * A document with unpublished edits is written twice: the published
       * version first, so required-field validation runs against what the site
       * actually serves, then the draft on top of it. Restoring only the latest
       * state would silently publish an editor's work in progress.
       */
      const base = entry.published ?? entry.latest;
      const data = {
        ...fromPortable(payload, collection, base, lookup, unresolved),
        _status: entry.published ? "published" : entry.status,
      };

      let id: number;
      if (existing.docs.length) {
        id = existing.docs[0].id as number;
        await payload.update({ collection, id, data: data as never, depth: 0, overrideAccess: true });
        updated++;
      } else {
        const doc = await payload.create({ collection, data: data as never, depth: 0, overrideAccess: true });
        id = doc.id as number;
        created++;
      }

      if (entry.published) {
        await payload.update({
          collection,
          id,
          data: {
            ...fromPortable(payload, collection, entry.latest, lookup, unresolved),
            _status: "draft",
          } as never,
          draft: true,
          depth: 0,
          overrideAccess: true,
        });
      }

      ids.set(entry.key, id);
    }

    lookup.set(collection, ids);
    console.log(`  ${collection.padEnd(10)} ${created} created, ${updated} updated`);
  }

  console.log("\n✓ import complete. Verify with `npm run parity`.\n");
  process.exit(0);
}

/**
 * Which field to match on for this document. Resources fall back to `category`
 * when they have no `sourceId`, and the key has to be looked up in the same
 * field it was derived from or the upsert silently creates a duplicate.
 */
function naturalKeyField(collection: ContentCollection, entry: SnapshotDoc): string {
  if (collection !== "resources") return NATURAL_KEY[collection];
  return typeof entry.latest.sourceId === "string" && entry.latest.sourceId ? "sourceId" : "category";
}

/*
 * The row this entry updates, or nothing when it is genuinely new.
 *
 * Two lookups, natural key first, because a snapshot that *renames* the natural
 * key cannot find its own row by the new name. A rename travels as `key` (the
 * old value, to match on) plus `latest.slug` (the new one, to write), which
 * works exactly once: run the same import again and the row now carries the new
 * slug, the match misses, and the upsert tries to *create* a duplicate — which
 * dies on the unique index, having reported nothing useful about why.
 *
 * That is not hypothetical. It is how the steps/level/part rename failed on a
 * re-run of its own pull request, because the Neon preview branch is reused
 * between runs rather than re-forked, so the second run met a database the
 * first had already renamed. Production would have hit it the same way on any
 * repeat import.
 *
 * `sourceId` is the Mongo `_id` a document was imported from: immutable,
 * unique, and never rewritten by a rename — so it is the identity to fall back
 * to. Sequential rather than an `or`, so a slug and a sourceId pointing at two
 * *different* rows (mid-swap, say) resolves to the natural key deterministically
 * instead of whichever the database returned first. `content.ts` reads by the
 * same pair for the same reason.
 */
async function findExisting(
  payload: Payload,
  collection: ContentCollection,
  entry: SnapshotDoc
): Promise<{ docs: Array<{ id: unknown }> }> {
  const find = (where: Where) =>
    payload.find({ collection, where, limit: 1, depth: 0, pagination: false, overrideAccess: true });

  const byNaturalKey = await find({
    [naturalKeyField(collection, entry)]: { equals: entry.key },
  });
  if (byNaturalKey.docs.length) return byNaturalKey;

  // Only for the collections that carry one; querying a field a collection does
  // not have is an error, not an empty result.
  const sourceId = entry.latest.sourceId;
  if (typeof sourceId !== "string" || !sourceId) return byNaturalKey;

  return find({ sourceId: { equals: sourceId } });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
