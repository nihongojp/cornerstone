import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";

const BRAND = "#B43D20";

interface Props {
  item: {
    number?: number;
    description?: string;
    selection?: string;
  };
}

/**
 * Placeholder for dragAndDropExercise items.
 * Displays the description; ready to be replaced with the full DragDrop component
 * once phrase banks and correct answers are defined in the DB document.
 */
const DragDropPlaceholder: React.FC<Props> = ({ item }) => (
  <Box
    sx={{
      width: "100%",
      maxWidth: 480,
      mx: "auto",
      px: { xs: 1, sm: 2 },
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2.5,
    }}
  >
    {item.number !== undefined && (
      <Chip
        label={`Exercise ${item.number}`}
        size="small"
        sx={{ fontWeight: 700, fontSize: "0.72rem", bgcolor: "rgba(180,61,32,0.08)", color: BRAND }}
      />
    )}

    <Box
      sx={{
        width: "100%",
        px: 3,
        py: 4,
        borderRadius: "20px",
        border: "2px dashed rgba(0,0,0,0.12)",
        bgcolor: "rgba(0,0,0,0.02)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <DragIndicatorRoundedIcon sx={{ fontSize: "2.5rem", color: "rgba(0,0,0,0.2)" }} />

      <Typography
        sx={{ fontWeight: 700, fontSize: "0.92rem", color: "text.secondary", textAlign: "center", maxWidth: 340 }}
      >
        {item.description || "Drag and drop exercise"}
      </Typography>

      {item.selection && (
        <Typography variant="caption" sx={{ color: "text.disabled" }}>
          Selection: {item.selection}
        </Typography>
      )}
    </Box>

    <Typography variant="caption" sx={{ color: "text.disabled", textAlign: "center" }}>
      Drag-and-drop will be enabled once phrase banks are defined
    </Typography>
  </Box>
);

export default DragDropPlaceholder;
