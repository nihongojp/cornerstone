"use client";

import React, { useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

import type { Term } from "@/payload/payload-types";
import { termAudio } from "./termText";
import MediaImage from "@/components/media/MediaImage";

const BRAND = "#B43D20";

/*
 * Same round "audio button" pattern used in FlashcardReview.tsx, MatchDotsMedia.tsx,
 * MatchAudioExercisePlaceholder.tsx and PronunciationExercise.tsx. None of those share a
 * component today, so this is a local copy rather than a new abstraction — consistent
 * with how the others already do it.
 */
const AudioButton: React.FC<{ audioUrl?: string }> = ({ audioUrl }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = Boolean(audioUrl);

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasAudio || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    setPlaying(true);
    audioRef.current.play().catch(() => setPlaying(false));
  };

  return (
    <>
      {hasAudio && (
        <audio ref={audioRef} src={audioUrl} preload="auto" onEnded={() => setPlaying(false)} />
      )}
      <Box
        onClick={playAudio}
        sx={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          bgcolor: hasAudio ? BRAND : "rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: hasAudio ? "pointer" : "default",
          boxShadow: hasAudio ? "0 4px 14px rgba(180,61,32,0.35)" : "none",
          animation: playing ? "audioPulse 1.2s ease-in-out infinite" : "none",
          "@keyframes audioPulse": {
            "0%,100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.4)" },
            "50%": { boxShadow: "0 0 0 12px rgba(180,61,32,0)" },
          },
          transition: "box-shadow 0.3s",
          flexShrink: 0,
        }}
      >
        {playing ? (
          <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: "1.4rem" }} />
        ) : (
          <VolumeUpRoundedIcon
            sx={{ color: hasAudio ? "#fff" : "rgba(0,0,0,0.25)", fontSize: "1.4rem" }}
          />
        )}
      </Box>
    </>
  );
};

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

      <AudioButton audioUrl={termAudio(term)} />

      {typeof term.strokes === "number" && (
        <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "text.secondary" }}>
          Strokes: {term.strokes}
        </Typography>
      )}
    </Box>
  );
};

export default CharacterSpotlight;
