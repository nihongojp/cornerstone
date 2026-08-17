// Stroke-order reference image + stroke count for each hiragana character,
// sourced from the "Answer"/"Notes" rows in "Lessons - シート2.csv". Only
// characters already live in the app's seeded lessons are included — new
// entries should only be added once the corresponding lesson ships.
//
// The images live in the `media` collection on private Blob storage, so these
// are Payload's auth-gated routes rather than absolute URLs: they resolve only
// for a signed-in viewer. `scripts/migrate/06-cloudinary-to-blob.ts` moved them
// off Cloudinary and holds the fixed list of source URLs — add new entries
// there too, or a freshly seeded database will be missing the media rows.
/*
 * SUPERSEDED, still wired. This data now also lives in the `terms` collection —
 * every kana term carries `strokes` and a `strokeOrder` upload, seeded from the
 * table below by `scripts/content/derive-terms.ts`.
 *
 * It survives here because `LessonPlayer` still reads it directly, and the
 * player only gets terms once blocks reference them by relationship (Phase 4).
 * Until then the two copies can drift: the CMS is the one an editor can change,
 * this one needs a deploy. If they disagree, the CMS is right. Delete this file
 * with the flashcard player rewrite, not before.
 */
export type KanaStrokeOrder = { imageUrl: string; strokes: number };

export const kanaStrokeOrder: Record<string, KanaStrokeOrder> = {
  あ: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.01_PM_ei0pad.png", strokes: 3 },
  い: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.07_PM_hhpoil.png", strokes: 2 },
  う: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.15_PM_s4uuwp.png", strokes: 2 },
  え: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.19_PM_pim0ml.png", strokes: 2 },
  お: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.23_PM_qd5ypr.png", strokes: 3 },
  か: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.30_PM_uljbn3.png", strokes: 3 },
  き: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.33_PM_n6m4pf.png", strokes: 3 },
  く: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.37_PM_etzwyb.png", strokes: 1 },
  け: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.40_PM_aryuah.png", strokes: 3 },
  こ: { imageUrl: "/api/media/file/Screenshot_2026-08-13_at_2.38.43_PM_cd7s34.png", strokes: 2 },
};
