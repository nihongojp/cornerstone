import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";
import { revalidateTag } from "next/cache";

import { TAGS } from "../../lib/content/tags";

/*
 * Content edits invalidate the app's cache the moment they are saved.
 *
 * This replaces the inbound POST /api/revalidate webhook the Airtable setup
 * needed. Payload runs in the same process as the app, so there is nothing to
 * call over the network and no shared secret to keep — an edit in /admin lands
 * on the site as soon as the next request re-reads it.
 *
 * Both the collection tag and the per-slug tag are dropped on every write that
 * changes what the site serves: a lesson's slug can change in the same save
 * that changes its body, so the previous document's tag is invalidated as well
 * or the old URL keeps serving the old copy until the backstop expiry.
 *
 * "that changes what the site serves" is doing real work in that sentence —
 * see `isDraftToDraft` below, which is what keeps autosave from purging the
 * cache several times a second while someone is typing.
 *
 * `revalidateTag` only exists inside a Next request. The import script drives
 * Payload from plain Node, where it throws — the guard below turns that into a
 * no-op, which is correct there: a script run has no render cache to purge,
 * and the import's own re-read comes from the database.
 */

type Doc = { slug?: string | null; format?: string | null; _status?: string | null };

/*
 * A save that leaves a document unpublished changes nothing the site serves, so
 * it must not purge anything.
 *
 * This is what makes autosave affordable. `payload/versions.ts` sets a 375ms
 * interval on all three drafting collections; without this guard, every one of
 * those ticks dropped both lesson-list tags and both per-slug tags, for as long
 * as a document sat open in the editor. The cache would be empty roughly
 * whenever anyone was authoring — which is exactly when the site is being
 * looked at.
 *
 * The four transitions, and why only one of them is silent:
 *
 *   draft → draft          nothing published changed          skip
 *   draft → published      it just went live                  purge
 *   published → draft      it just came down                  purge
 *   published → published  the live copy changed              purge
 *
 * Deliberately conservative in two places. A document being *created* has no
 * `previousDoc`, so it purges once even though a new draft is not yet served.
 * And the first autosave after editing a published document reads as
 * published → draft, so it purges once too, before the rest of that editing
 * session goes quiet. Both cost a single extra purge; both fail in the
 * direction of serving fresh content rather than stale, which is the only
 * direction worth failing in here.
 */
export function isDraftToDraft(doc?: Doc, previousDoc?: Doc): boolean {
  return doc?._status === "draft" && previousDoc?._status === "draft";
}

function purge(tags: string[]): void {
  for (const tag of tags) {
    try {
      // "max" is a stale-while-revalidate profile: the next visitor is served
      // the cached copy while the refresh happens behind them.
      revalidateTag(tag, "max");
    } catch {
      // Outside a Next request (the import script). Nothing is cached there.
      return;
    }
  }
}

/*
 * A lesson belongs to one list or the other depending on `format`, but a save
 * can change the format itself — so both collection tags are dropped rather
 * than the one the document currently claims.
 */
function lessonTags(doc?: Doc): string[] {
  const tags = [TAGS.lessons, TAGS.newLessons];
  const slug = doc?.slug;
  if (slug) tags.push(TAGS.lesson(slug), TAGS.newLesson(slug));
  return tags;
}

export const revalidateLesson: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  if (isDraftToDraft(doc as Doc, previousDoc as Doc)) return doc;
  purge([...lessonTags(doc as Doc), ...lessonTags(previousDoc as Doc)]);
  return doc;
};

export const revalidateLessonDelete: CollectionAfterDeleteHook = ({ doc }) => {
  purge(lessonTags(doc as Doc));
  return doc;
};

export const revalidateResources: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  if (isDraftToDraft(doc as Doc, previousDoc as Doc)) return doc;
  purge([TAGS.resources]);
  return doc;
};

export const revalidateResourcesDelete: CollectionAfterDeleteHook = ({ doc }) => {
  purge([TAGS.resources]);
  return doc;
};

/*
 * A course rename or reorder changes which lesson follows which, and that is
 * baked into every step lesson's `nextSlug` at read time — so a course write
 * invalidates the lesson lists, not just itself.
 */
export const revalidateCourse: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  if (isDraftToDraft(doc as Doc, previousDoc as Doc)) return doc;
  purge([TAGS.lessons, TAGS.newLessons]);
  return doc;
};

export const revalidateCourseDelete: CollectionAfterDeleteHook = ({ doc }) => {
  purge([TAGS.lessons, TAGS.newLessons]);
  return doc;
};

/*
 * A term's audio, reading or image is read through whatever lesson references
 * it, so editing one term can change any number of lessons — and there is no
 * reverse index from a term back to them.
 *
 * Purging both lesson lists wholesale rather than building one: a term edit is
 * rare and the lists rebuild in a single query each, while a reverse index
 * would have to be maintained on every lesson write, which is not. If terms
 * ever become high-churn this is the thing to make precise.
 */
export const revalidateTerm: CollectionAfterChangeHook = ({ doc }) => {
  purge([TAGS.lessons, TAGS.newLessons]);
  return doc;
};

export const revalidateTermDelete: CollectionAfterDeleteHook = ({ doc }) => {
  purge([TAGS.lessons, TAGS.newLessons]);
  return doc;
};
