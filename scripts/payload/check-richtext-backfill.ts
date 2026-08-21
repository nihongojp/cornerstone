import { config } from "dotenv";

/*
 * Proves the `richtext_prose` migration moved the copy rather than dropping it.
 *
 *   npm run payload:check-richtext -- --before   # writes a snapshot of the text
 *   npm run payload:check-richtext -- --after    # compares jsonb against it
 *
 * Why this exists rather than a read of the site: the migration DROPs the column
 * it read from, so afterwards there is nothing left to compare against — and the
 * failure mode of dropping a column is a field that is simply empty. `content:verify`
 * cannot catch it either, because empty prose is a legitimate state.
 *
 * The `--after` comparison is exact. It does not ask "does this look like the
 * text?" — it recomputes `textToLexical(original)` and requires the stored
 * document to equal it byte for byte, so a transform that silently mangled one
 * paragraph is a failure rather than a shrug.
 *
 * Point DATABASE_URL at the throwaway Neon branch. Nothing here writes.
 */

config({ path: ".env.local" });

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { textToLexical } from "../../src/lib/content/textToLexical";
import { pinSslMode } from "../../src/lib/db/connection";

/** Mirrors PROSE_COLUMNS in the migration. Kept beside it deliberately: if the
 *  two disagree, this reports a column the migration did not convert. */
const PROSE_COLUMNS: Array<[table: string, column: string]> = [
  ["courses", "description"],
  ["_courses_v", "version_description"],
  ["lessons_blocks_video_page", "content"],
  ["lessons_blocks_terms_page", "content"],
  ["lessons_blocks_grammar_page", "content"],
  ["lessons_blocks_content_page", "content"],
  ["_lessons_v_blocks_video_page", "content"],
  ["_lessons_v_blocks_terms_page", "content"],
  ["_lessons_v_blocks_grammar_page", "content"],
  ["_lessons_v_blocks_content_page", "content"],
  ["lessons_blocks_info_break", "content"],
  ["lessons_blocks_life_useful_fact", "content"],
  ["lessons_blocks_fact_break", "content"],
  ["_lessons_v_blocks_info_break", "content"],
  ["_lessons_v_blocks_life_useful_fact", "content"],
  ["_lessons_v_blocks_fact_break", "content"],
  ["lessons", "fun_fact"],
  ["lessons", "notes"],
  ["_lessons_v", "version_fun_fact"],
  ["_lessons_v", "version_notes"],
  ["terms", "notes"],
  ["resources_items", "description"],
  ["_resources_v_version_items", "description"],
];

const SNAPSHOT = path.resolve("content/.richtext-backfill-check.json");

/**
 * A stable serialization, with object keys sorted.
 *
 * `jsonb` does not store a document verbatim — it normalises key order (by key
 * length, then bytewise), so `{type, children, direction, …}` comes back as
 * `{type, format, indent, version, children, direction}`. Comparing
 * `JSON.stringify` output directly therefore reports every single row as changed
 * while nothing is wrong, which is exactly what the first run of this check did.
 * Sorting both sides compares the data instead of the encoding.
 */
function canonical(value: unknown): string {
  const sorted = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(sorted);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, sorted(v)])
      );
    }
    return node;
  };
  return JSON.stringify(sorted(value));
}

type Before = Record<string, { total: number; nonEmpty: number; values: Record<string, number> }>;

const keyOf = (table: string, column: string) => `${table}.${column}`;

async function main() {
  const mode = process.argv.includes("--after") ? "after" : "before";
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — see .env.example");
  const pool = new Pool({ connectionString: pinSslMode(url) });

  const dataType = async (table: string, column: string): Promise<string | null> => {
    const { rows } = await pool.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'payload' AND table_name = $1 AND column_name = $2`,
      [table, column]
    );
    return rows[0]?.data_type ?? null;
  };

  console.log(`\n${mode === "before" ? "Recording" : "Checking"} ${PROSE_COLUMNS.length} prose column(s) on ${new URL(process.env.DATABASE_URL!).host}\n`);

  if (mode === "before") {
    const before: Before = {};
    for (const [table, column] of PROSE_COLUMNS) {
      const type = await dataType(table, column);
      if (type === null) {
        console.log(`  ${keyOf(table, column).padEnd(46)} (column does not exist yet)`);
        continue;
      }
      if (type === "jsonb") {
        console.error(`\n✗ ${keyOf(table, column)} is already jsonb — the migration has run. Snapshot before it, not after.\n`);
        process.exit(1);
      }

      const { rows } = await pool.query<{ value: string | null }>(
        `SELECT "${column}" AS value FROM "payload"."${table}"`
      );
      const values: Record<string, number> = {};
      let nonEmpty = 0;
      for (const { value } of rows) {
        if (typeof value !== "string" || value.trim() === "") continue;
        nonEmpty++;
        values[value] = (values[value] ?? 0) + 1;
      }
      before[keyOf(table, column)] = { total: rows.length, nonEmpty, values };
      console.log(
        `  ${keyOf(table, column).padEnd(46)} ${String(nonEmpty).padStart(4)} non-empty of ${String(rows.length).padStart(4)} row(s)`
      );
    }

    writeFileSync(SNAPSHOT, JSON.stringify(before, null, 2));
    const totals = Object.values(before).reduce((n, c) => n + c.nonEmpty, 0);
    console.log(`\n✓ recorded ${totals} non-empty prose value(s) → ${path.relative(process.cwd(), SNAPSHOT)}\n`);
    await pool.end();
    return;
  }

  // ── after ─────────────────────────────────────────────────────────────────
  const before: Before = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  const failures: string[] = [];
  let checked = 0;

  for (const [table, column] of PROSE_COLUMNS) {
    const key = keyOf(table, column);
    const type = await dataType(table, column);

    if (type !== "jsonb") {
      failures.push(`${key} is ${type ?? "missing"}, not jsonb — the migration did not convert it`);
      continue;
    }

    const { rows } = await pool.query<{ value: unknown }>(
      `SELECT "${column}" AS value FROM "payload"."${table}" WHERE "${column}" IS NOT NULL`
    );

    const expected = before[key];
    if (!expected) {
      // No `before` entry: the column did not exist then (terms.notes on a branch
      // cut before the terms migration). Only assert it is now jsonb.
      console.log(`  ${key.padEnd(46)} jsonb, ${rows.length} document(s) (no before-state)`);
      continue;
    }

    if (rows.length !== expected.nonEmpty) {
      failures.push(
        `${key}: ${expected.nonEmpty} non-empty value(s) before, ${rows.length} document(s) after — ` +
          `${expected.nonEmpty - rows.length} lost`
      );
      continue;
    }

    // Every stored document must be exactly what the tested transform produces
    // for one of the recorded values, with the same multiplicity.
    const wanted = new Map<string, number>();
    for (const [text, count] of Object.entries(expected.values)) {
      const json = canonical(textToLexical(text));
      wanted.set(json, (wanted.get(json) ?? 0) + count);
    }

    const failuresBefore = failures.length;
    for (const { value } of rows) {
      const json = canonical(value);
      const remaining = wanted.get(json);
      if (remaining === undefined || remaining === 0) {
        failures.push(
          `${key}: stored a document that no recorded value converts to — ${json.slice(0, 160)}…`
        );
        break;
      }
      wanted.set(json, remaining - 1);
      checked++;
    }

    const missing = [...wanted.values()].reduce((n, c) => n + c, 0);
    if (missing > 0) failures.push(`${key}: ${missing} recorded value(s) have no stored document`);

    const ok = failures.length === failuresBefore;
    console.log(
      `  ${key.padEnd(46)} ${String(rows.length).padStart(4)} document(s) ${ok ? "match exactly" : "DO NOT MATCH"}`
    );
  }

  await pool.end();

  if (failures.length) {
    console.error(`\n✗ ${failures.length} problem(s):\n`);
    for (const f of failures) console.error(`    ${f}`);
    console.error();
    process.exit(1);
  }

  console.log(`\n✓ ${checked} prose document(s) are byte-identical to textToLexical(original)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
