import type { CollectionBeforeDeleteHook } from "payload";
import { APIError } from "payload";

import { findReferences, type References } from "./references";

/*
 * Refuses to delete a term or a media file that something still points at, with
 * a message naming what to go and fix.
 *
 * The counterpart to `guardLessonDelete`, and deliberately the same shape — but
 * where that one is the error message for a rule the database already enforces
 * (`user_progress.lesson_id` is ON DELETE RESTRICT), this one *is* the rule.
 * Nothing underneath it says no: the foreign keys pointing at `terms` and
 * `media` are ON DELETE SET NULL, 6 and 55 of them respectively. Postgres will
 * happily empty every reference and report success.
 *
 * That is what makes it worth a hook rather than a role. Deleting a referenced
 * term does not fail, it *blanks* — a `termRef` with no term renders nothing at
 * all, on purpose, so a learner never sees a database id. The lesson keeps
 * working, the word simply stops appearing, and nobody finds out. Gating the
 * button on being an admin only moves who can cause that; refusing with the
 * list is what stops it, for everyone.
 *
 * ── What it does not block ──────────────────────────────────────────────────
 *
 * References that exist only in saved versions. Every draft ever autosaved
 * keeps a copy of what it referenced, so enforcing those would make a term
 * undeletable the moment it had ever been used. They are mentioned in the
 * message instead, because "gone from the current lessons but still in their
 * history" is a thing worth knowing before you delete.
 */

/*
 * The sentence an editor actually reads, kept separate from the query so the
 * wording can be tested without a database. Every clause after the first is
 * conditional, and getting one wrong produces a message that is confidently
 * misleading rather than obviously broken — "referenced 1 times", or a
 * version-only count presented as if it blocked the delete.
 */
export function describeRefusal(subject: string, refs: References): string {
  const owners = refs.owners.length ? ` It is used by ${refs.owners.join(", ")}.` : "";
  const rest = refs.unattributed
    ? ` ${refs.unattributed} other reference${refs.unattributed === 1 ? "" : "s"} could not be traced to a document.`
    : "";
  const history = refs.inVersions
    ? ` (${refs.inVersions} more sit in saved versions, which do not block this.)`
    : "";

  return (
    `${subject} is still referenced ${refs.live} ${refs.live === 1 ? "time" : "times"}.` +
    owners +
    rest +
    " Deleting it would empty those references without any error — remove them first." +
    history
  );
}

function guard(collection: "terms" | "media", describe: (doc: Record<string, unknown>) => string) {
  const hook: CollectionBeforeDeleteHook = async ({ req, id }) => {
    const doc = (await req.payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>;

    const refs = await findReferences(collection, id);
    if (refs.live === 0) return;

    throw new APIError(describeRefusal(describe(doc), refs), 400, undefined, true);
  };
  return hook;
}

export const guardTermDelete = guard("terms", (doc) => {
  const label = doc.display || doc.key;
  return label ? `The term "${String(label)}"` : "This term";
});

export const guardMediaDelete = guard("media", (doc) => {
  const label = doc.filename;
  return label ? `"${String(label)}"` : "This file";
});
