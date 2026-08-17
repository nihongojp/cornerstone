import type { CollectionConfig } from "payload";

/*
 * Version behaviour for the three drafting collections — Courses, Lessons and
 * Resources. The same set that shares `access/readPublished.ts`, and for the
 * same reason: a rule that has to hold across all three is stated once.
 *
 * ── What each one is actually for ───────────────────────────────────────────
 *
 * `versions: { drafts: true }` shipped with neither set, so every deliberate
 * save since has been retained forever, and `_lessons_v` already holds most of
 * the block rows in the database. `maxPerDoc` is what bounds that: measured on
 * a throwaway branch, twenty-five draft saves of one lesson climb to twenty
 * versions and stop.
 *
 * Autosave is *not* what that cap is protecting against, which is worth stating
 * because the opposite is the natural assumption. Payload does not write a new
 * version per tick — it updates the existing autosave version in place, which
 * is what the `autosave` column added alongside these settings marks. Measured
 * the same way: thirty autosave writes 375ms apart left one row, holding the
 * thirtieth value. Version count grows with deliberate saves, not with time
 * spent in the editor.
 *
 * So the real cost of autosave is write volume and what each write triggers,
 * which is the next paragraph rather than this one.
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
   * biggest thing in the database.
   *
   * Pruning happens on write — the oldest beyond the cap go as the newest
   * arrives. A document already over twenty therefore stays over it until the
   * next time somebody saves it, rather than being trimmed by the migration.
   * Nothing is currently over: the fullest lesson holds seventeen.
   */
  maxPerDoc: 20,
};
