import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";

interface CharacterSpotlightProps {
  character: string;
  script: "Hiragana" | "Katakana";
  imageUrl: string;
  strokes: number;
}

// Full-screen "spotlight" for a single character, shown before the
// flashcards step so each new hiragana/katakana gets its own moment.
// Audio isn't wired up yet — the button is a visual placeholder.
const CharacterSpotlight: React.FC<CharacterSpotlightProps> = ({ character, script, imageUrl, strokes }) => {
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
        disabled
        sx={{
          width: 48,
          height: 48,
          color: "rgba(0,0,0,0.3)",
          bgcolor: "rgba(0,0,0,0.08)",
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
