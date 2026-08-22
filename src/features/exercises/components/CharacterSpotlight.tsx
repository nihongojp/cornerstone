"use client";

import React from "react";
import { Box, Typography } from "@mui/material";

import type { Term } from "@/payload/payload-types";
import MediaAudio from "@/components/media/MediaAudio";
import MediaImage from "@/components/media/MediaImage";

/*
 * One character, large, with its stroke-order diagram.
 *
 * This used to be a screen the flashcard player generated: it walked the
 * lesson's flashcard strings, looked each character up in `data/kanaStrokeOrder.ts`
 * — a hardcoded table of ten media URLs — and pushed a step per hit. So the
 * screens existed in no lesson, could not be reordered, edited or removed by an
 * author, and had no Payload row to key progress on.
 *
 * The catalogue holds the same data (`strokes` and the `strokeOrder` upload on a
 * kana term), so it is a `vocabList` with `layout: "spotlight"` now — an authored
 * screen like any other, and the hardcoded table is gone.
 *
 * The audio button was a permanently-disabled placeholder. The term carries its
 * own recording, so it plays when there is one and is absent when there is not,
 * rather than being present and dead.
 */
const CharacterSpotlight: React.FC<{ term: Term }> = ({ term }) => {
  const character = term.japanese ?? term.romaji ?? term.key;
  const script = term.katakana ? "Hiragana" : "Character";

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
      }}
    >
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: "1rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "text.secondary",
        }}
      >
        {script}
      </Typography>

      {term.strokeOrder ? (
        <Box sx={{ width: { xs: 200, sm: 260 } }}>
          <MediaImage value={term.strokeOrder} size="card" />
        </Box>
      ) : (
        // No diagram for this character. The character itself is the content —
        // better than an empty frame where a picture is meant to be.
        <Typography sx={{ fontSize: { xs: "7rem", sm: "9rem" }, lineHeight: 1, fontWeight: 700 }}>
          {character}
        </Typography>
      )}

      <MediaAudio value={term.audio} />

      {typeof term.strokes === "number" && (
        <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "text.secondary" }}>
          Strokes: {term.strokes}
        </Typography>
      )}
    </Box>
  );
};

export default CharacterSpotlight;
