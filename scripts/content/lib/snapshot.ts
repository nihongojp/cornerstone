import type { Block, Field, Payload } from "payload";

import { PROSE_BLOCKS, PROSE_INLINE_BLOCKS } from "../../../src/payload/fields/prose";

/*
 * The snapshot format, and the one interesting thing about it: references.
 *
 * A Payload document id is a serial integer. Re-importing a snapshot into an
 * empty database produces different ids, so anything that stores an id — a
 * `relationship`, an `upload` — is meaningless the moment it leaves the
 * database it came from. Every reference therefore travels as a *natural key*
 * (a course's slug, a media file's filename) and is resolved back to an id on
 * the way in.
 *
 * The rewriting is driven by the collection's own field schema rather than a
 * hand-maintained list of paths, which is the whole point: Phase 1 turns 19
 * media text fields into `upload` fields and Phase 2 adds `relationship`s to
 * `terms`, nested inside blocks inside an array. Walking the schema means none
 * of that needs a change here — a new relationship field is portable the day
 * it is added, and a field this file cannot make portable stops the export
 * rather than being silently written out as a stale integer.
 *
 * Phase 3 is where that promise needed work rather than holding for free: a
 * `richText` field's references live inside its own JSON, below the level the
 * field schema describes. See `PROSE_BLOCK_BY_SLUG`.
 *
 * What a snapshot does NOT contain:
 *
 *  - Version history. Each document round-trips its current published state
 *    and, if it differs, its current draft state. Everything older is dropped.
 *  - Media bytes. Those live in the Vercel Blob store, which is durable on its
 *    own; `media.json` carries the metadata so an import can verify every
 *    referenced file is present and fail loudly when it is not. Restoring into
 *    a database with an empty media catalogue is out of scope by design.
 */

/**
 * The collections a snapshot covers, in the order they must be imported —
 * dependencies first, because a reference is resolved against what is already
 * in. `terms` sits before `lessons` for the blocks that will point at it.
 *
 * Note the division of labour with `content/terms.json`: that file is the
 * one-time *derivation* of a vocabulary from the legacy strings embedded in
 * lessons (see `derive-terms.ts`). This snapshot is the ongoing backup of what
 * the CMS holds now, terms included. Once seeded, the snapshot is the source.
 */
export const CONTENT_COLLECTIONS = ["courses", "terms", "lessons", "resources"] as const;
export type ContentCollection = (typeof CONTENT_COLLECTIONS)[number];

/**
 * The field that identifies a document across databases.
 *
 * `resources` is the awkward one: `category` is required but not unique, and
 * `sourceId` only exists on the rows that came from Mongo. The key is
 * `sourceId ?? category` and the export asserts the result is unique, so a
 * collision is a loud failure at snapshot time rather than a silent overwrite
 * at import time.
 */
export const NATURAL_KEY: Record<string, string> = {
  courses: "slug",
  terms: "key",
  lessons: "slug",
  resources: "sourceId",
  media: "filename",
};

/** Fallback key, used when the primary one is absent on a given document. */
const FALLBACK_KEY: Record<string, string> = {
  resources: "category",
};

export type PortableDoc = Record<string, unknown>;

export type SnapshotDoc = {
  /** Natural key — how this document is matched on import. */
  key: string;
  /** `draft` or `published`, the status the latest state carries. */
  status: string;
  /** Latest state, drafts included. */
  latest: PortableDoc;
  /**
   * The published state, only when a newer draft exists on top of it.
   * Absent means latest *is* what is published (or the doc has never been
   * published).
   */
  published?: PortableDoc;
};

export type MediaRecord = {
  filename: string;
  alt: string | null;
  caption: string | null;
  mimeType: string | null;
  filesize: number | null;
  width: number | null;
  height: number | null;
};

export type Manifest = {
  takenAt: string;
  gitSha: string;
  payloadVersion: string;
  counts: Record<string, number>;
};

/** A reference the export could not turn into a natural key. */
export type BrokenRef = {
  collection: string;
  doc: string;
  field: string;
  detail: string;
};

/** Marker written in place of a relationship/upload value. */
type Ref = { $ref: string; $collection: string };

function isRef(value: unknown): value is Ref {
  return Boolean(value) && typeof value === "object" && "$ref" in (value as object);
}

/** The natural-key value for a document, or null when it has none. */
export function keyOf(collection: string, doc: Record<string, unknown>): string | null {
  const primary = doc[NATURAL_KEY[collection]];
  if (typeof primary === "string" && primary.trim()) return primary.trim();
  if (typeof primary === "number") return String(primary);

  const fallbackField = FALLBACK_KEY[collection];
  if (fallbackField) {
    const fallback = doc[fallbackField];
    if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  }
  return null;
}

/*
 * Payload's field list mixes named fields with presentational containers that
 * have no key of their own (`row`, `collapsible`, unnamed `tabs`). Descending
 * needs to treat the two differently: a named container owns a level of the
 * data, an unnamed one does not.
 */
function namedChildren(field: Field): Field[] | null {
  if (field.type === "group" || field.type === "array") return field.fields;
  return null;
}

function transparentChildren(field: Field): Field[] | null {
  if (field.type === "row" || field.type === "collapsible") return field.fields;
  if (field.type === "tabs") {
    // A tab with a `name` owns a level of data; one without is transparent.
    return field.tabs.flatMap((tab) => ("name" in tab && tab.name ? [] : tab.fields));
  }
  return null;
}

function namedTabs(field: Field): Array<{ name: string; fields: Field[] }> {
  if (field.type !== "tabs") return [];
  return field.tabs.flatMap((tab) =>
    "name" in tab && tab.name ? [{ name: tab.name, fields: tab.fields }] : []
  );
}

export type Walk = {
  /** Turn one relationship/upload value into its portable form, or back. */
  value: (value: unknown, field: Field, path: string) => unknown;
  /** Something the walk cannot make portable. Stops the run; never silent. */
  problem: (path: string, detail: string) => void;
  /**
   * Replace a whole `richText` value. Only `upgrade-snapshot-prose.ts` supplies
   * this, to convert a snapshot taken before the fields became rich text; the
   * export and import leave the document alone and only rewrite what is inside it.
   */
  prose?: (value: unknown, path: string) => unknown;
};

/*
 * ── References inside rich text ──────────────────────────────────────────────
 *
 * A Lexical document stores an upload or a relationship as a node in its own
 * JSON, and Payload's field schema stops at the `richText` field — it does not
 * describe what is inside. So without this, an image dropped into a paragraph or
 * a `termRef` pointing at a vocabulary entry would be written to the snapshot as
 * a bare integer: portable-looking, and wrong the moment it is imported into a
 * database with different serial ids. Silently, which is the failure this file
 * exists to prevent.
 *
 * Two kinds of node, handled differently:
 *
 *  - `upload` and `relationship` nodes are self-describing. They carry
 *    `relationTo` next to `value`, so the same rewriting the schema-driven walk
 *    does applies with no extra knowledge.
 *  - `block` and `inlineBlock` nodes are not. Their fields are arbitrary, and a
 *    relationship inside one — `termRef.term` — is an integer with nothing to
 *    mark it as a reference. The only way to find it is the block's own field
 *    schema, which is why these are imported from `payload/fields/prose.ts`:
 *    the same arrays `BlocksFeature` is built from, so there is no second list
 *    to fall out of step. A block slug that is not in them stops the export
 *    rather than being passed through.
 */
const PROSE_BLOCK_BY_SLUG = new Map<string, Block>(
  [...PROSE_BLOCKS, ...PROSE_INLINE_BLOCKS].map((block) => [block.slug, block])
);

function walkLexical(value: unknown, path: string, walk: Walk): void {
  const root = (value as { root?: unknown } | null | undefined)?.root;
  if (root && typeof root === "object") walkLexicalNodes([root], path, walk);
}

function walkLexicalNodes(nodes: unknown[], path: string, walk: Walk): void {
  nodes.forEach((node, index) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "?";
    const here = `${path}/${type}[${index}]`;

    if (
      (type === "upload" || type === "relationship") &&
      record.value !== undefined &&
      record.value !== null
    ) {
      const relationTo = record.relationTo;
      if (typeof relationTo !== "string" || !relationTo) {
        walk.problem(
          `${here}.value`,
          `a ${type} node in rich text has no relationTo, so its target collection is unknown`
        );
      } else {
        // A synthesized field: everything downstream reads only `type` and
        // `relationTo`, and the node supplies both.
        const field = { type, name: "value", relationTo } as unknown as Field;
        record.value = walk.value(record.value, field, `${here}.value`);
      }
    }

    if (type === "block" || type === "inlineBlock") {
      const fields = record.fields;
      const blockType = (fields as { blockType?: unknown } | null | undefined)?.blockType;
      const block = PROSE_BLOCK_BY_SLUG.get(String(blockType));
      if (!block) {
        walk.problem(
          `${here}.fields`,
          `rich text holds a "${String(blockType)}" block, which is not in PROSE_BLOCKS or ` +
            "PROSE_INLINE_BLOCKS — add it there (the arrays the editor is built from) so any " +
            "reference inside it can be made portable"
        );
      } else {
        walkFields(block.fields, fields, `${here}:${String(blockType)}`, walk);
      }
    }

    if (Array.isArray(record.children)) walkLexicalNodes(record.children, here, walk);
  });
}

export function walkFields(fields: Field[], data: unknown, path: string, walk: Walk): void {
  if (!data || typeof data !== "object") return;
  const record = data as Record<string, unknown>;

  for (const field of fields) {
    const transparent = transparentChildren(field);
    if (transparent) {
      walkFields(transparent, record, path, walk);
      continue;
    }

    for (const tab of namedTabs(field)) {
      walkFields(tab.fields, record[tab.name], `${path}.${tab.name}`, walk);
    }

    if (!("name" in field) || !field.name) continue;
    const name = field.name;
    const here = path ? `${path}.${name}` : name;
    const value = record[name];
    if (value === undefined || value === null) continue;

    /*
     * A `join` is a read-only view of the other side of a relationship —
     * `courses.lessons` is just "every lesson whose course is me". Payload
     * populates it on read and ignores it on write, so carrying it would bloat
     * the snapshot with a second copy of every lesson (courses.json was larger
     * than lessons.json before this) and imply an ownership the schema does
     * not have. Dropped on the way out; nothing to drop on the way back.
     */
    if (field.type === "join") {
      delete record[name];
      continue;
    }

    if (field.type === "relationship" || field.type === "upload") {
      record[name] = walk.value(value, field, here);
      continue;
    }

    // Rich text carries its references inside its own JSON, below where the
    // field schema describes anything. See PROSE_BLOCK_BY_SLUG above.
    if (field.type === "richText") {
      if (walk.prose) record[name] = walk.prose(value, here);
      walkLexical(record[name], here, walk);
      continue;
    }

    if (field.type === "blocks") {
      if (!Array.isArray(value)) continue;
      value.forEach((row, i) => {
        const blockType = (row as Record<string, unknown>)?.blockType;
        const block = field.blocks.find((b) => b.slug === blockType);
        if (block) walkFields(block.fields, row, `${here}[${i}]:${String(blockType)}`, walk);
      });
      continue;
    }

    if (field.type === "array") {
      if (!Array.isArray(value)) continue;
      value.forEach((row, i) => walkFields(field.fields, row, `${here}[${i}]`, walk));
      continue;
    }

    const children = namedChildren(field);
    if (children) walkFields(children, value, here, walk);
  }
}

function relationTargets(field: Field): string[] {
  if (field.type !== "relationship" && field.type !== "upload") return [];
  const to = field.relationTo as string | string[];
  return Array.isArray(to) ? to : [to];
}

/**
 * Strip a document to its portable form: no ids, no timestamps, every
 * reference replaced by a natural key.
 *
 * Nested `id`s on array and block rows are deliberately *kept*. They are the
 * stable identity of an exercise, and Phase 4 re-keys learner progress onto
 * them — a re-import that reshuffled them would invalidate saved positions.
 */
export function toPortable(
  payload: Payload,
  collection: string,
  doc: Record<string, unknown>,
  broken: BrokenRef[]
): PortableDoc {
  const clone = structuredClone(doc) as Record<string, unknown>;
  const docKey = keyOf(collection, doc) ?? "(unkeyed)";

  delete clone.id;
  delete clone.createdAt;
  delete clone.updatedAt;

  const fields = payload.collections[collection]?.config.fields ?? [];

  const one = (value: unknown, field: Field, path: string): unknown => {
    const targets = relationTargets(field);

    // Polymorphic: Payload stores { relationTo, value }.
    if (value && typeof value === "object" && "relationTo" in value && "value" in value) {
      const poly = value as { relationTo: string; value: unknown };
      return one(poly.value, { ...field, relationTo: poly.relationTo } as Field, path);
    }

    const target = targets[0];
    if (!target) return value;

    if (typeof value === "number" || typeof value === "string") {
      broken.push({
        collection,
        doc: docKey,
        field: path,
        detail:
          `points at ${target} id ${value} but came back unpopulated — ` +
          "raise the export depth, that id cannot be made portable",
      });
      return value;
    }

    const related = value as Record<string, unknown>;
    const key = keyOf(target, related);
    if (!key) {
      broken.push({
        collection,
        doc: docKey,
        field: path,
        detail: `${target} document ${String(related.id)} has no ${NATURAL_KEY[target]} to reference it by`,
      });
      return value;
    }
    return { $ref: key, $collection: target } satisfies Ref;
  };

  walkFields(fields, clone, "", {
    value: (value, field, path) =>
      Array.isArray(value) ? value.map((v) => one(v, field, path)) : one(value, field, path),
    problem: (path, detail) => broken.push({ collection, doc: docKey, field: path, detail }),
  });

  return clone;
}

/**
 * The inverse: resolve every `$ref` back to an id in the target database.
 *
 * `lookup` is the collection → natural key → id table the importer builds as
 * it goes, which is why courses import before lessons.
 */
export function fromPortable(
  payload: Payload,
  collection: string,
  doc: PortableDoc,
  lookup: Map<string, Map<string, number>>,
  unresolved: BrokenRef[]
): Record<string, unknown> {
  const clone = structuredClone(doc) as Record<string, unknown>;
  const docKey = keyOf(collection, doc as Record<string, unknown>) ?? "(unkeyed)";
  const fields = payload.collections[collection]?.config.fields ?? [];

  const one = (value: unknown, _field: Field, path: string): unknown => {
    if (!isRef(value)) return value;
    const id = lookup.get(value.$collection)?.get(value.$ref);
    if (id === undefined) {
      unresolved.push({
        collection,
        doc: docKey,
        field: path,
        detail: `no ${value.$collection} with ${NATURAL_KEY[value.$collection]} "${value.$ref}"`,
      });
      return null;
    }
    return id;
  };

  walkFields(fields, clone, "", {
    value: (value, field, path) =>
      Array.isArray(value) ? value.map((v) => one(v, field, path)) : one(value, field, path),
    problem: (path, detail) => unresolved.push({ collection, doc: docKey, field: path, detail }),
  });

  return clone;
}

/** Every filename a snapshot references, for the import-time presence check. */
export function referencedMediaFilenames(docs: SnapshotDoc[]): Set<string> {
  const out = new Set<string>();
  const walk = (node: unknown): void => {
    if (isRef(node)) {
      if (node.$collection === "media") out.add(node.$ref);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") return Object.values(node).forEach(walk);
  };
  for (const doc of docs) {
    walk(doc.latest);
    if (doc.published) walk(doc.published);
  }
  return out;
}
