"use client";

import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";

interface CharacterSpotlightProps {
  character: string;
  script: "Hiragana" | "Katakana";
  imageUrl: string;
  strokes: number;
  audioUrl?: string;
}

// Full-screen "spotlight" for a single character, shown before the
// flashcards step so each new hiragana/katakana gets its own moment.
const CharacterSpotlight: React.FC<CharacterSpotlightProps> = ({ character, script, imageUrl, strokes, audioUrl }) => {
  const playAudio = () => {
    if (!audioUrl) return;
    new Audio(audioUrl).play().catch(() => {});
  };
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

      <Box
        component="img"
        src={imageUrl}
        alt={character}
        sx={{
          width: { xs: 200, sm: 260 },
          height: { xs: 200, sm: 260 },
          objectFit: "contain",
        }}
      />

      <IconButton
        aria-label="Play audio"
        onClick={playAudio}
        disabled={!audioUrl}
        sx={{
          width: 48,
          height: 48,
          color: "#fff",
          bgcolor: audioUrl ? "#B43D20" : "rgba(0,0,0,0.15)",
          boxShadow: audioUrl ? "0 2px 10px rgba(180,61,32,0.3)" : "none",
          "&:hover": { bgcolor: audioUrl ? "#9D351C" : "rgba(0,0,0,0.15)" },
          "&.Mui-disabled": { color: "rgba(255,255,255,0.7)" },
        }}
      >
        <VolumeUpRoundedIcon />
      </IconButton>

      <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "text.secondary" }}>
        Strokes: {strokes}
      </Typography>
    </Box>
  );
};

export default CharacterSpotlight;
