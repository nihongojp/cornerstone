/*
 * A one-off: converts the prose in `content/snapshot/*.json` from plain strings
 * to Lexical documents, matching the `richtext_prose` migration.
 *
 *   npm run content:upgrade-snapshot            # dry run
 *   npm run content:upgrade-snapshot -- --yes   # rewrite the files
 *
 * ── Why this has to happen in the same change as the migration ──────────────
 *
 * The snapshot is the storage-independent copy of the content and the thing that
 * makes every later phase cheap — export, wipe a throwaway branch, import,
 * `npm run parity`. Once the columns are `jsonb`, a snapshot holding
 * `"description": "Japan's national broadcaster…"` no longer imports: Payload is
 * handed a string where it expects a document. The round-trip test that is the
 * acceptance test for Phase 0b would break, and it would break at the next
 * re-import rather than here, which is the wrong place to find out.
 *
 * ── Why transform the file rather than re-export ────────────────────────────
 *
 * Re-exporting from a migrated database would also work, and would pick up
 * whatever else that database happens to hold — a different media catalogue, a
 * probe row, an editor's unsaved draft. This changes exactly one thing: how the
 * prose is represented. Everything else in the snapshot stays byte-identical,
 * so the diff is reviewable.
 *
 * It runs off the collection configs rather than a list of field paths, for the
 * same reason the rest of the snapshot code does: `PAGE_PROSE.content` alone
 * appears on four blocks, and a hand-written path list is how you miss one.
 * No database connection — the configs are plain objects.
 *
 * Idempotent: a value that is already a document is left alone, so re-running is
 * safe and so is running it on a half-converted file.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Field } from "payload";

import { Courses } from "../../src/payload/collections/Courses";
import { Lessons } from "../../src/payload/collections/Lessons";
import { Resources } from "../../src/payload/collections/Resources";
import { Terms } from "../../src/payload/collections/Terms";
import { textToLexical } from "../../src/lib/content/textToLexical";

import { CONTENT_COLLECTIONS, walkFields, type SnapshotDoc } from "./lib/snapshot";

const DIR = path.resolve("content/snapshot");
const WRITE = process.argv.includes("--yes");

const FIELDS: Record<string, Field[]> = {
  courses: Courses.fields,
  terms: Terms.fields,
  lessons: Lessons.fields,
  resources: Resources.fields,
};

function main() {
  let converted = 0;
  let alreadyDocuments = 0;
  const problems: string[] = [];
  const changedFiles: string[] = [];

  for (const collection of CONTENT_COLLECTIONS) {
    const file = path.join(DIR, `${collection}.json`);
    const docs = JSON.parse(readFileSync(file, "utf8")) as SnapshotDoc[];
    const fields = FIELDS[collection];
    let touched = 0;

    const prose = (value: unknown, where: string): unknown => {
      if (value === null || value === undefined) return value;
      if (typeof value === "string") {
        converted++;
        touched++;
        return textToLexical(value);
      }
      // Already a document. Counted rather than ignored, so a partially
      // converted file is visible instead of looking like a no-op.
      if (typeof value === "object") {
        alreadyDocuments++;
        return value;
      }
      problems.push(`${collection} ${where}: prose is a ${typeof value}, which is neither`);
      return value;
    };

    for (const doc of docs) {
      for (const state of [doc.latest, doc.published]) {
        if (!state) continue;
        walkFields(fields, state, `${doc.key}`, {
          // Nothing else is rewritten: a `$ref` is already portable and must
          // survive untouched.
          value: (value) => value,
          problem: (where, detail) => problems.push(`${collection} ${where}: ${detail}`),
          prose,
        });
      }
    }

    console.log(`  ${collection.padEnd(10)} ${String(touched).padStart(4)} string(s) → document(s)`);
    if (touched && WRITE) {
      writeFileSync(file, `${JSON.stringify(docs, null, 2)}\n`);
      changedFiles.push(`${collection}.json`);
    }
  }

  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s) — nothing written:\n`);
    for (const p of problems.slice(0, 20)) console.error(`    ${p}`);
    process.exit(1);
  }

  console.log(
    `\n${converted} string(s) converted, ${alreadyDocuments} already document(s).` +
      (WRITE
        ? ` Rewrote ${changedFiles.length} file(s).\n`
        : " Dry run — re-run with --yes to write.\n")
  );
}

main();
