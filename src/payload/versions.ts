import type { CollectionConfig } from "payload";

/*
 * Version behaviour for the three drafting collections — Courses, Lessons and
 * Resources. The same set that shares `access/readPublished.ts`, and for the
 * same reason: a rule that has to hold across all three is stated once.
 *
 * ── Why both settings arrive together ───────────────────────────────────────
 *
 * They are not two independent knobs. `versions: { drafts: true }` shipped with
 * neither, which means every save since has been retained forever: `_lessons_v`
 * is already the largest table in the schema, holding more block rows than the
 * live tables it mirrors. Turning autosave on without a retention cap would take
 * that from "grows with edits" to "grows with time spent in the editor" — one
 * afternoon of authoring is a few thousand versions at this interval.
 *
 * So `maxPerDoc` is the thing that makes autosave affordable, and autosave is
 * the thing that makes `maxPerDoc` necessary. Changing one without the other is
 * almost certainly a mistake.
 *
 * ── 375ms ───────────────────────────────────────────────────────────────────
 *
 * Payload's default is 800ms. 375 is chosen to sit below the point where an
 * editor notices the gap between typing and "Saving..." settling, while still
 * debouncing hard enough that a burst of typing is one write rather than twenty.
 *
 * ── The dependency that is easy to miss ─────────────────────────────────────
 *
 * Autosave is only safe here because `hooks/revalidate.ts` refuses to purge
 * cache tags on a draft→draft save. Without that guard this interval becomes a
 * `revalidateTag` storm every 375ms for as long as a lesson is open in the
 * editor — the whole lesson list, both format variants, on every keystroke's
 * worth of debounce. If that guard is ever removed, this comes out with it.
 */
export const draftingVersions: CollectionConfig["versions"] = {
  drafts: { autosave: { interval: 375 } },
  /*
   * Twenty is a working window, not an archive: enough to walk back an
   * afternoon's mistakes, few enough that the version tables stop being the
   * biggest thing in the database. Payload prunes the oldest beyond this on
   * write, so it applies retroactively to the backlog already there rather than
   * only to new saves.
   */
  maxPerDoc: 20,
};
