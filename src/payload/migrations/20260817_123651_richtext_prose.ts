import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

import { textToLexical } from '../../lib/content/textToLexical'

/*
 * The nine prose fields become rich text: `varchar` → `jsonb`, with the authored
 * copy carried across.
 *
 * ── Why this is hand-written ─────────────────────────────────────────────────
 *
 * `payload migrate:create` generated 23 statements of the form
 *
 *     ALTER TABLE "payload"."lessons_blocks_info_break"
 *       ALTER COLUMN "content" SET DATA TYPE jsonb;
 *
 * and that is unrunnable: Postgres has no implicit cast from text to jsonb, so
 * every one of those errors with "column cannot be cast automatically". Adding
 * `USING content::jsonb` would make it run and then fail on the first row,
 * because "Konnichiwa!" is not a JSON document. There is no in-place version of
 * this change.
 *
 * So it is expand/contract, four statements per column: add a `jsonb` sibling,
 * fill it, drop the original, rename the sibling into its place. The RENAME here
 * is deliberate and is not the rename the schema-change notes warn about — that
 * one is drizzle-kit *guessing* that a dropped column and an added one are the
 * same column, which would carry values into a mismatched type. This renames a
 * column this migration created and filled itself.
 *
 * ── Why the backfill is TypeScript ──────────────────────────────────────────
 *
 * Payload emits the ADD and the DROP and nothing in between, so the data
 * movement is always hand-written. Here it cannot be written in SQL at all: the
 * transform splits text into paragraphs and soft breaks and builds a Lexical
 * document, which in plpgsql would mean reimplementing `textToLexical` — the one
 * function in this change that has tests. A migration is TypeScript, so it just
 * calls it.
 *
 * ── Why one list drives everything ──────────────────────────────────────────
 *
 * 23 columns, 14 of them in `_lessons_v_*` / `_courses_v` / `_resources_v_*`
 * version mirrors. Those mirrors hold roughly 13× the rows of the live tables
 * and are the half that gets missed when this is written out by hand — that is
 * exactly what happened during the Phase 1 media migration. Every statement
 * below is generated from `PROSE_COLUMNS`, so a column is either in all four
 * steps or in none of them, and the guard before the DROPs counts what did not
 * convert across all 23 at once.
 */

/**
 * Every column changing type, taken from the generated migration's own list.
 *
 * The pairing with the *base* table is what makes the version mirrors hard to
 * forget: `lessons.fun_fact` and `_lessons_v.version_fun_fact` are the same
 * field, and the column names differ, so neither can be derived from the other.
 */
const PROSE_COLUMNS: Array<{ table: string; column: string }> = [
  // courses.description
  { table: 'courses', column: 'description' },
  { table: '_courses_v', column: 'version_description' },

  // The shared `PAGE_PROSE.content` on the four *Page blocks
  { table: 'lessons_blocks_video_page', column: 'content' },
  { table: 'lessons_blocks_terms_page', column: 'content' },
  { table: 'lessons_blocks_grammar_page', column: 'content' },
  { table: 'lessons_blocks_content_page', column: 'content' },
  { table: '_lessons_v_blocks_video_page', column: 'content' },
  { table: '_lessons_v_blocks_terms_page', column: 'content' },
  { table: '_lessons_v_blocks_grammar_page', column: 'content' },
  { table: '_lessons_v_blocks_content_page', column: 'content' },

  // infoBreak.content, lifeUsefulFact.content, factBreak.content
  { table: 'lessons_blocks_info_break', column: 'content' },
  { table: 'lessons_blocks_life_useful_fact', column: 'content' },
  { table: 'lessons_blocks_fact_break', column: 'content' },
  { table: '_lessons_v_blocks_info_break', column: 'content' },
  { table: '_lessons_v_blocks_life_useful_fact', column: 'content' },
  { table: '_lessons_v_blocks_fact_break', column: 'content' },

  // lessons.funFact, lessons.notes
  { table: 'lessons', column: 'fun_fact' },
  { table: 'lessons', column: 'notes' },
  { table: '_lessons_v', column: 'version_fun_fact' },
  { table: '_lessons_v', column: 'version_notes' },

  // terms.notes — no version mirror, `terms` has no drafts by design
  { table: 'terms', column: 'notes' },

  // resources.items[].description
  { table: 'resources_items', column: 'description' },
  { table: '_resources_v_version_items', column: 'description' },
]

/** The sibling column each value moves through. Dropped by the rename. */
const staging = (column: string) => `${column}__migrating`

const qualified = (table: string) => `"payload"."${table}"`

/**
 * `db.execute` returns a `pg` QueryResult under the pooled adapter this project
 * uses, and a bare row array under others. Reading rows has to work either way.
 */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const rows = (result as { rows?: unknown }).rows
  return Array.isArray(rows) ? (rows as T[]) : []
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // ── Expand ────────────────────────────────────────────────────────────────
  for (const { table, column } of PROSE_COLUMNS) {
    await db.execute(
      sql.raw(`ALTER TABLE ${qualified(table)} ADD COLUMN "${staging(column)}" jsonb;`),
    )
  }

  // ── Convert ───────────────────────────────────────────────────────────────
  /*
   * Grouped by distinct value rather than by row. `textToLexical` is a pure
   * function of the text, so every row holding the same string converts to the
   * same document — and the same paragraph of copy is genuinely repeated across
   * a live table and its version mirror many times over.
   */
  let converted = 0
  for (const { table, column } of PROSE_COLUMNS) {
    const result = await db.execute(
      sql.raw(
        `SELECT DISTINCT "${column}" AS value FROM ${qualified(table)}
           WHERE "${column}" IS NOT NULL AND btrim("${column}") <> '';`,
      ),
    )

    for (const { value } of rowsOf<{ value: string }>(result)) {
      const document = JSON.stringify(textToLexical(value))
      const updated = await db.execute(
        sql`UPDATE ${sql.raw(qualified(table))}
              SET ${sql.raw(`"${staging(column)}"`)} = ${document}::jsonb
            WHERE ${sql.raw(`"${column}"`)} = ${value};`,
      )
      converted += rowsOf(updated).length || (updated as { rowCount?: number }).rowCount || 0
    }
  }
  payload.logger.info(`richtext_prose: converted ${converted} value(s) across ${PROSE_COLUMNS.length} column(s)`)

  // ── Guard ─────────────────────────────────────────────────────────────────
  /*
   * Nothing non-empty may be left unconverted when the DROPs run, because a DROP
   * is where authored copy would disappear without a trace. One count across
   * every column, raised as an exception so the whole migration rolls back
   * rather than committing a partial conversion.
   */
  const unconverted = PROSE_COLUMNS.map(
    ({ table, column }) =>
      `(SELECT count(*) FROM ${qualified(table)} WHERE "${column}" IS NOT NULL
          AND btrim("${column}") <> '' AND "${staging(column)}" IS NULL)`,
  ).join('\n      + ')

  await db.execute(
    sql.raw(`
    DO $$
    DECLARE unconverted bigint;
    BEGIN
      SELECT ${unconverted}
      INTO unconverted;
      IF unconverted > 0 THEN
        RAISE EXCEPTION 'richtext_prose: % prose value(s) did not convert. Dropping the text columns now would lose them.', unconverted;
      END IF;
    END $$;`),
  )

  // ── Contract ──────────────────────────────────────────────────────────────
  for (const { table, column } of PROSE_COLUMNS) {
    await db.execute(
      sql.raw(`ALTER TABLE ${qualified(table)} DROP COLUMN "${column}";`),
    )
    await db.execute(
      sql.raw(
        `ALTER TABLE ${qualified(table)} RENAME COLUMN "${staging(column)}" TO "${column}";`,
      ),
    )
  }
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  /*
   * The same shape backwards, flattening each document to the text it came from.
   * `convertLexicalToPlaintext` is the inverse of `textToLexical` — joining
   * paragraphs with a blank line and soft breaks with a newline — which
   * `textToLexical.roundtrip.test.ts` asserts rather than assumes.
   *
   * Structure an author added after the migration is lost here: a list becomes
   * its lines, a term reference becomes nothing at all. That is inherent to
   * going back to a `varchar`, and it is why this is a rollback path rather than
   * something to run casually.
   */
  for (const { table, column } of PROSE_COLUMNS) {
    await db.execute(
      sql.raw(`ALTER TABLE ${qualified(table)} ADD COLUMN "${staging(column)}" varchar;`),
    )
  }

  let flattened = 0
  for (const { table, column } of PROSE_COLUMNS) {
    const result = await db.execute(
      sql.raw(
        `SELECT DISTINCT "${column}"::text AS value FROM ${qualified(table)}
           WHERE "${column}" IS NOT NULL;`,
      ),
    )

    for (const { value } of rowsOf<{ value: string }>(result)) {
      const text = convertLexicalToPlaintext({ data: JSON.parse(value) })
      await db.execute(
        sql`UPDATE ${sql.raw(qualified(table))}
              SET ${sql.raw(`"${staging(column)}"`)} = ${text}
            WHERE ${sql.raw(`"${column}"`)}::text = ${value};`,
      )
      flattened++
    }
  }
  payload.logger.info(`richtext_prose: flattened ${flattened} document(s) back to text`)

  for (const { table, column } of PROSE_COLUMNS) {
    await db.execute(sql.raw(`ALTER TABLE ${qualified(table)} DROP COLUMN "${column}";`))
    await db.execute(
      sql.raw(
        `ALTER TABLE ${qualified(table)} RENAME COLUMN "${staging(column)}" TO "${column}";`,
      ),
    )
  }
}
