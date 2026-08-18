import type { SQL } from "drizzle-orm";

/*
 * "What still points at this?" — for collections the database will not protect.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Deleting a lesson is safe to get wrong: `user_progress.lesson_id` is an
 * ON DELETE RESTRICT foreign key, so Postgres refuses and `guardLessonDelete`
 * turns that refusal into a sentence. Terms and Media have no such backstop.
 * Measured on the real schema: of the foreign keys pointing at `payload.media`,
 * 55 are ON DELETE SET NULL, and 6 of those pointing at `payload.terms` are.
 *
 * SET NULL is the silent one. Delete a term and every block referencing it
 * keeps its row, with the reference quietly emptied — a `termRef` then renders
 * *nothing at all*, which is deliberate (a learner must never see a database
 * id) and is exactly what makes it impossible to notice. Delete a media file
 * and the blob goes with it, leaving however many blocks pointing at nothing.
 *
 * So this asks the schema, rather than hard-coding a list of places to check.
 * Which blocks reference a term is a thing that changes every time somebody
 * adds one, and a hand-maintained list is the kind of second copy that drifts.
 *
 * ── What counts as blocking ─────────────────────────────────────────────────
 *
 * Only SET NULL references, and only live ones:
 *
 *  - CASCADE references are the row's own children (`terms_furigana`,
 *    `terms_texts`). They are *supposed* to go when it does.
 *  - Version mirrors (`_lessons_v*`) are history. Blocking on them would make
 *    a term undeletable forever, since every draft ever saved keeps a copy.
 *    They are counted and mentioned, not enforced.
 */

type Fk = { table: string; column: string };

/** Cheap normalisation: neon-http and node-postgres disagree on result shape. */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/*
 * Introspected once per process. The schema only changes on deploy, and a
 * delete is rare enough that a cold first call costs nothing anybody notices.
 */
const fkCache = new Map<string, Fk[]>();

async function setNullReferencesTo(
  target: string,
  db: { execute: (q: SQL) => Promise<unknown> },
  sql: typeof import("drizzle-orm").sql,
): Promise<Fk[]> {
  const cached = fkCache.get(target);
  if (cached) return cached;

  const result = await db.execute(sql`
    SELECT tc.table_name AS table, kcu.column_name AS column
      FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = rc.constraint_name
     WHERE ccu.table_schema = 'payload'
       AND ccu.table_name = ${target}
       AND rc.delete_rule = 'SET NULL'
  `);

  const fks = rowsOf(result).map((r) => ({
    table: String(r.table),
    column: String(r.column),
  }));
  fkCache.set(target, fks);
  return fks;
}

/** A version mirror, not live content — Payload names them all with a leading underscore. */
const isVersionTable = (table: string) => table.startsWith("_");

export type References = {
  /**
   * What holds a live reference, named the way an editor would recognise it —
   * a lesson title, or `the term "sayounara"`. Deduplicated and sorted.
   */
  owners: string[];
  /** Live references that resolved to nothing nameable. Counted, never hidden. */
  unattributed: number;
  /** Live references in total. Zero means the delete is safe. */
  live: number;
  /** References that live only in saved versions. Reported, never enforced. */
  inVersions: number;
};

/**
 * Everything still pointing at `payload.<target>` row `id`.
 *
 * Walks each referencing row up its `_parent_id` / `parent_id` chain looking
 * for the lesson that owns it — a block row's parent is the lesson, and a
 * nested block row's parent is the block. Four hops is well past the deepest
 * shape in this schema; anything that does not resolve is counted rather than
 * dropped, so the total is always honest even when the attribution is not.
 */
export async function findReferences(target: "terms" | "media", id: number | string): Promise<References> {
  const { db } = await import("../../lib/db");
  const { sql } = await import("drizzle-orm");

  const fks = await setNullReferencesTo(target, db as never, sql);

  const owners = new Set<string>();
  let unattributed = 0;
  let live = 0;
  let inVersions = 0;

  for (const fk of fks) {
    const found = rowsOf(
      await db.execute(
        sql`SELECT id FROM ${sql.identifier("payload")}.${sql.identifier(fk.table)}
             WHERE ${sql.identifier(fk.column)} = ${id}`,
      ),
    );
    if (found.length === 0) continue;

    if (isVersionTable(fk.table)) {
      inVersions += found.length;
      continue;
    }

    live += found.length;
    for (const row of found) {
      const owner = await ownerFor(fk.table, row.id as string | number, db as never, sql);
      if (owner) owners.add(owner);
      else unattributed++;
    }
  }

  return { owners: [...owners].sort(), unattributed, live, inVersions };
}

/** The parent column Payload uses, in the order it uses them. */
const PARENT_COLUMNS = ["_parent_id", "parent_id"];

/*
 * Which column leads out of a table, and where to. Cached because the walk
 * asks per *row*, and without this a media file referenced from fifty places
 * re-queries information_schema a hundred times — measured at 2.8s for one
 * delete before this was here.
 */
const parentCache = new Map<string, { column: string; table: string } | null>();

async function ownerFor(
  table: string,
  rowId: string | number,
  db: { execute: (q: SQL) => Promise<unknown> },
  sql: typeof import("drizzle-orm").sql,
): Promise<string | null> {
  let currentTable = table;
  let currentId: string | number = rowId;

  for (let hop = 0; hop < 4; hop++) {
    if (currentTable === "lessons") {
      const row = rowsOf(
        await db.execute(sql`SELECT title FROM payload.lessons WHERE id = ${currentId}`),
      )[0];
      const title = row?.title;
      return typeof title === "string" && title ? title : null;
    }

    // Media is referenced by terms as well as by lessons — a term's own audio,
    // image or stroke-order picture. Saying so beats reporting it as a bare
    // count, because it names the thing the editor has to go and edit.
    if (currentTable === "terms") {
      const row = rowsOf(
        await db.execute(sql`SELECT display, key FROM payload.terms WHERE id = ${currentId}`),
      )[0];
      const label = (row?.display || row?.key) as string | undefined;
      return label ? `the term "${label}"` : null;
    }

    const parent = await parentOf(currentTable, currentId, db, sql);
    if (!parent) return null;
    currentTable = parent.table;
    currentId = parent.id;
  }
  return null;
}

async function parentOf(
  table: string,
  rowId: string | number,
  db: { execute: (q: SQL) => Promise<unknown> },
  sql: typeof import("drizzle-orm").sql,
): Promise<{ table: string; id: string | number } | null> {
  const cached = parentCache.get(table);
  if (cached === null) return null;
  if (cached) {
    const row = rowsOf(
      await db.execute(sql`
        SELECT ${sql.identifier(cached.column)} AS parent_id
          FROM ${sql.identifier("payload")}.${sql.identifier(table)}
         WHERE id = ${rowId}
      `),
    )[0];
    const parentId = row?.parent_id;
    if (parentId === null || parentId === undefined) return null;
    return { table: cached.table, id: parentId as string | number };
  }

  for (const column of PARENT_COLUMNS) {
    const fk = rowsOf(
      await db.execute(sql`
        SELECT ccu.table_name AS parent_table
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON kcu.constraint_name = tc.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'payload'
           AND tc.table_name = ${table}
           AND kcu.column_name = ${column}
         LIMIT 1
      `),
    )[0];
    if (!fk) continue;
    parentCache.set(table, { column, table: String(fk.parent_table) });

    const row = rowsOf(
      await db.execute(sql`
        SELECT ${sql.identifier(column)} AS parent_id
          FROM ${sql.identifier("payload")}.${sql.identifier(table)}
         WHERE id = ${rowId}
      `),
    )[0];
    const parentId = row?.parent_id;
    if (parentId === null || parentId === undefined) return null;

    return { table: String(fk.parent_table), id: parentId as string | number };
  }

  parentCache.set(table, null);
  return null;
}
