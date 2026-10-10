"use client";

import React, { useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

import { termAudio, termText } from "@/features/exercises/components/termText";
import { renderableImage } from "@/lib/content/media";
import AudioSpeedControl, { type AudioSpeed } from "@/components/media/AudioSpeedControl";
import SelfRecordButton from "@/features/exercises/components/SelfRecordButton";
import type { Term } from "@/payload/payload-types";

const BRAND = "#B43D20";

/*
 * The round "audio button" pattern repeated across CharacterSpotlight,
 * FlashcardReview, MatchDotsMedia and PronunciationExercise — a local copy
 * again rather than a new shared abstraction, consistent with how those do
 * it. Just the circle: the speed control sits below the whole button row
 * instead (see `TermCard`), so this button lines up with the record button
 * beside it rather than sitting taller.
 */
const AudioButton: React.FC<{ audioUrl?: string; speed: number }> = ({ audioUrl, speed }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = Boolean(audioUrl);

  const playAudio = () => {
    if (!hasAudio || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.playbackRate = speed;
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
          width: 48,
          height: 48,
          borderRadius: "50%",
          bgcolor: hasAudio ? BRAND : "rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: hasAudio ? "pointer" : "default",
          boxShadow: hasAudio ? "0 4px 14px rgba(180,61,32,0.3)" : "none",
          animation: playing ? "termCardPulse 1.2s ease-in-out infinite" : "none",
          "@keyframes termCardPulse": {
            "0%,100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.4)" },
            "50%": { boxShadow: "0 0 0 10px rgba(180,61,32,0)" },
          },
          transition: "box-shadow 0.3s",
        }}
      >
        {playing ? (
          <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: "1.3rem" }} />
        ) : (
          <VolumeUpRoundedIcon sx={{ color: hasAudio ? "#fff" : "rgba(0,0,0,0.25)", fontSize: "1.3rem" }} />
        )}
      </Box>
    </>
  );
};

/*
 * One term, as a card: what to look at, what to listen to, and a place to
 * record yourself. Shared by the per-lesson review page and the per-level
 * one — a term reviews the same way regardless of which page got you there.
 */
const TermCard: React.FC<{ term: Term }> = ({ term }) => {
  const written = termText(term, "plain");
  const reading = termText(term, "reading");
  const meaning = term.meaning?.trim();
  const [speed, setSpeed] = useState<AudioSpeed>(1);

  /*
   * Written form falls back through the chain in `renderableTerm` — for a
   * term with no authored script (the grammar catalogue's romaji-only
   * majority, see `docs/content-backlog.md`), `written` is just its romaji
   * standing in for a character that was never written. That is not the
   * same thing as an actual kana/kanji word, and showing it at the same
   * size read as if every grammar term had real script behind it. Smaller
   * here says "this is a stand-in," the way the rest of the app already
   * treats a fallback as a lesser answer than the real one.
   */
  const hasScript = Boolean(term.japanese?.trim() || term.katakana?.trim());

  const image = renderableImage(term.image, "thumbnail");

  return (
    <Box
      sx={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "16px",
        bgcolor: "#fff",
        p: 2.5,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        textAlign: "center",
      }}
    >
      {image && (
        <Box
          component="img"
          src={image.src}
          alt={image.alt}
          sx={{
            width: 56,
            height: 56,
            borderRadius: "10px",
            objectFit: "cover",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        />
      )}

      <Typography
        sx={{
          fontSize: hasScript ? "2rem" : "1.15rem",
          fontWeight: 700,
          lineHeight: 1.2,
          color: hasScript ? "inherit" : "text.secondary",
        }}
      >
        {written}
      </Typography>

      {reading && reading !== written && (
        <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontWeight: 600 }}>
          {reading}
        </Typography>
      )}

      {meaning && (
        <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>{meaning}</Typography>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, mt: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <AudioButton audioUrl={termAudio(term)} speed={speed} />
          <SelfRecordButton />
        </Box>
        <AudioSpeedControl speed={speed} onChange={setSpeed} />
      </Box>
    </Box>
  );
};

export default TermCard;
