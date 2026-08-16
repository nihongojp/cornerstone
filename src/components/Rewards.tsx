"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";

interface RewardProps {
  title: string;
  xp: number | string;
  imageUrl?: string;
}

// Awards/XP/item-preview are disconnected for the moment — this screen just
// confirms the lesson is done. The props above are left in place (unused)
// so the achievement/xp data flow from Lesson.tsx doesn't need to change
// when this is reconnected later.
const Rewards: React.FC<RewardProps> = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Stagger-in
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <Box
      sx={{
        textAlign: "center",
        width: "100%",
        maxWidth: 480,
        mx: "auto",
        px: { xs: 1.5, sm: 2 },
        py: { xs: 2, sm: 3 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Trophy icon */}
      <Box
        sx={{
          width: { xs: 72, sm: 88 },
          height: { xs: 72, sm: 88 },
          borderRadius: "50%",
          bgcolor: "rgba(180,61,32,0.08)",
          border: "3px solid rgba(180,61,32,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mx: "auto",
          mb: 2,
          transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s",
          transform: visible ? "scale(1)" : "scale(0.4)",
          opacity: visible ? 1 : 0,
          animation: visible ? "trophy-pulse 2.5s 0.5s ease-in-out infinite" : "none",
          "@keyframes trophy-pulse": {
            "0%, 100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.2)" },
            "50%": { boxShadow: "0 0 0 16px rgba(180,61,32,0)" },
          },
        }}
      >
        <EmojiEventsRoundedIcon sx={{ fontSize: { xs: "2.5rem", sm: "3rem" }, color: "#B43D20" }} />
      </Box>

      {/* Headline */}
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: { xs: "1.6rem", sm: "2rem" },
          letterSpacing: "-0.02em",
          color: "#1C1917",
          transition: "transform 0.5s 0.15s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s 0.15s",
          transform: visible ? "translateY(0)" : "translateY(16px)",
          opacity: visible ? 1 : 0,
          lineHeight: 1.2,
        }}
      >
        Lesson Complete! 🎉
      </Typography>
    </Box>
  );
};

export default Rewards;