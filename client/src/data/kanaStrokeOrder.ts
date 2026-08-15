// Stroke-order reference image + stroke count for each hiragana character,
// sourced from the "Answer"/"Notes" rows in "Lessons - シート2.csv". Only
// characters already live in the app's seeded lessons are included — new
// entries should only be added once the corresponding lesson ships.
export type KanaStrokeOrder = { imageUrl: string; strokes: number };

export const kanaStrokeOrder: Record<string, KanaStrokeOrder> = {
  あ: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657160/Screenshot_2026-08-13_at_2.38.01_PM_ei0pad.png",
    strokes: 3,
  },
  い: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657160/Screenshot_2026-08-13_at_2.38.07_PM_hhpoil.png",
    strokes: 2,
  },
  う: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657160/Screenshot_2026-08-13_at_2.38.15_PM_s4uuwp.png",
    strokes: 2,
  },
  え: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657160/Screenshot_2026-08-13_at_2.38.19_PM_pim0ml.png",
    strokes: 2,
  },
  お: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.23_PM_qd5ypr.png",
    strokes: 3,
  },
  か: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.30_PM_uljbn3.png",
    strokes: 3,
  },
  き: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.33_PM_n6m4pf.png",
    strokes: 3,
  },
  く: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.37_PM_etzwyb.png",
    strokes: 1,
  },
  け: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.40_PM_aryuah.png",
    strokes: 3,
  },
  こ: {
    imageUrl:
      "https://res.cloudinary.com/dxxezusx5/image/upload/v1786657161/Screenshot_2026-08-13_at_2.38.43_PM_cd7s34.png",
    strokes: 2,
  },
};
