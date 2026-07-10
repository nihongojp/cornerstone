import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";

const BRAND = "#B43D20";

interface Props {
  item: {
    number?: number;
    phrase: string;
    audioUrl?: string;
  };
}

/**
 * Placeholder for matchAudioExercise items.
 * Shows the phrase prominently with a disabled audio button.
 * Ready to be upgraded to a full audio-quiz component once assets are available.
 */
const MatchAudioExercisePlaceholder: React.FC<Props> = ({ item }) => {
  const hasAudio = item.audioUrl && !item.audioUrl.toUpperCase().includes("PLACEHOLDER");

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 480,
        mx: "auto",
        px: { xs: 1, sm: 2 },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      {item.number !== undefined && (
        <Chip
          label={`Exercise ${item.number}`}
          size="small"
          sx={{ fontWeight: 700, fontSize: "0.72rem", bgcolor: "rgba(180,61,32,0.08)", color: BRAND }}
        />
      )}

      {/* Phrase */}
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: { xs: "2rem", sm: "2.4rem" },
          letterSpacing: "-0.02em",
          textAlign: "center",
          color: "#1C1917",
        }}
      >
        {item.phrase}
      </Typography>

      {/* Audio button */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          px: 4,
          py: 2.5,
          borderRadius: "20px",
          bgcolor: "rgba(0,0,0,0.03)",
          border: "1px dashed rgba(0,0,0,0.15)",
          opacity: 0.55,
          cursor: "default",
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            bgcolor: "rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VolumeUpRoundedIcon sx={{ fontSize: "1.6rem", color: "rgba(0,0,0,0.4)" }} />
        </Box>
        <Typography variant="body2" sx={{ color: "text.disabled", fontWeight: 600 }}>
          {hasAudio ? "Play audio" : "Audio not yet available"}
        </Typography>
      </Box>

      <Typography variant="caption" sx={{ color: "text.disabled", textAlign: "center" }}>
        Listen and identify the phrase — coming soon
      </Typography>
    </Box>
  );
};

export default MatchAudioExercisePlaceholder;
