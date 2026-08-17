import type { Field, Payload } from "payload";

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
 * What a snapshot does NOT contain:
 *
 *  - Version history. Each document round-trips its current published state
 *    and, if it differs, its current draft state. Everything older is dropped.
 *  - Media bytes. Those live in the Vercel Blob store, which is durable on its
 *    own; `media.json` carries the metadata so an import can verify every
 *    referenced file is present and fail loudly when it is not. Restoring into
 *    a database with an empty media catalogue is out of scope by design.
 */

/** The collections a snapshot covers, in the order they must be imported. */
export const CONTENT_COLLECTIONS = ["courses", "lessons", "resources"] as const;
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

type Walk = {
  /** Turn one relationship/upload value into its portable form, or back. */
  value: (value: unknown, field: Field, path: string) => unknown;
};

function walkFields(fields: Field[], data: unknown, path: string, walk: Walk): void {
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
