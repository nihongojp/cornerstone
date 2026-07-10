import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";

const BRAND = "#B43D20";

interface MatchingItem {
  phrase: string;
  audioUrl?: string;
  imageUrl?: string;
  englishTranslation?: string;
}

interface Props {
  item: {
    instructions?: string;
    description?: string;
    rows?: string[];
    items?: MatchingItem[];
  };
}

/**
 * Placeholder for matchingExercise items.
 * Displays the instruction and phrase list with disabled audio/image indicators.
 * Ready to be replaced with a real interactive implementation once assets are available.
 */
const MatchingExercisePlaceholder: React.FC<Props> = ({ item }) => {
  const instruction = item.instructions || item.description || "Match the phrases";
  const matchItems: MatchingItem[] = item.items || [];
  const hasImage = (item.rows || []).includes("image");
  const hasEnglish = matchItems.some((m) => m.englishTranslation && !m.englishTranslation.includes("PLACEHOLDER"));

  return (
    <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          mb: 2.5,
          borderRadius: "12px",
          bgcolor: "rgba(180,61,32,0.05)",
          border: "1px solid rgba(180,61,32,0.12)",
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: "0.92rem", color: BRAND }}>
          🔗 {instruction}
        </Typography>
      </Box>

      {/* Phrase rows */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {matchItems.map((m, i) => (
          <Box
            key={i}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1.5,
              borderRadius: "12px",
              border: "1px solid rgba(0,0,0,0.08)",
              bgcolor: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", flex: 1 }}>
              {m.phrase}
            </Typography>

            {hasEnglish && m.englishTranslation && !m.englishTranslation.includes("PLACEHOLDER") && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {m.englishTranslation}
              </Typography>
            )}

            {/* Audio indicator */}
            <Chip
              icon={<VolumeUpRoundedIcon sx={{ fontSize: "0.85rem !important" }} />}
              label="Audio soon"
              size="small"
              sx={{ fontSize: "0.65rem", height: 20, opacity: 0.45 }}
            />

            {/* Image indicator */}
            {hasImage && (
              <Chip
                icon={<ImageRoundedIcon sx={{ fontSize: "0.85rem !important" }} />}
                label="Image soon"
                size="small"
                sx={{ fontSize: "0.65rem", height: 20, opacity: 0.45 }}
              />
            )}
          </Box>
        ))}
      </Box>

      <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.disabled", textAlign: "center" }}>
        Interactive matching will be enabled once audio and images are available
      </Typography>
    </Box>
  );
};

export default MatchingExercisePlaceholder;
