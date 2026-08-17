import assert from "node:assert/strict";
import test from "node:test";

import { isDraftToDraft } from "./revalidate";

/*
 * The guard that makes autosave affordable — see `payload/versions.ts`, which
 * sets a 375ms interval on all three drafting collections.
 *
 * Both ways of getting this wrong are silent, which is why it is tested rather
 * than eyeballed:
 *
 *  - Too eager (always false) and nothing breaks, visibly. The cache is simply
 *    purged several times a second while anyone has a document open, and the
 *    only symptom is that the site is slow for reasons no page-level test can
 *    attribute.
 *  - Too lax (draft treated as "nothing to do" without checking the previous
 *    status) and unpublishing stops purging — a lesson taken down stays on the
 *    site until the backstop expiry, which is the failure that actually matters.
 *
 * So the four transitions are enumerated rather than sampled.
 */

const draft = { _status: "draft" };
const published = { _status: "published" };

test("draft → draft is the one transition that skips revalidation", () => {
  assert.equal(isDraftToDraft(draft, draft), true);
});

test("publishing revalidates", () => {
  assert.equal(isDraftToDraft(published, draft), false);
});

test("unpublishing revalidates", () => {
  // The one that must never be skipped: the document is coming off the site.
  assert.equal(isDraftToDraft(draft, published), false);
});

test("editing a published document revalidates", () => {
  assert.equal(isDraftToDraft(published, published), false);
});

/*
 * A create has no `previousDoc`. Purging once for a document that is not yet
 * served is wasteful rather than wrong, and the alternative — treating "no
 * previous" as draft — would swallow the first publish of a document created
 * and published in one save.
 */
test("a create, which has no previous document, revalidates", () => {
  assert.equal(isDraftToDraft(draft, undefined), false);
  assert.equal(isDraftToDraft(published, undefined), false);
});

/*
 * Collections without `versions.drafts` — Terms and Media — have no `_status`
 * at all. Their hooks must keep purging: `revalidateTerm` is the only thing
 * that invalidates a lesson when the word it renders changes.
 */
test("a collection with no draft status always revalidates", () => {
  assert.equal(isDraftToDraft({}, {}), false);
  assert.equal(isDraftToDraft(undefined, undefined), false);
});
