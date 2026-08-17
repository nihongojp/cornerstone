"use client";

import React from "react";
import { Box, Typography } from "@mui/material";

interface RewardInfoProps {
  title: string;
  /*
   * A node rather than a string — the lesson notes behind this are rich text
   * now, so the caller hands over a rendered `<RichText>`. See `Fact.tsx`, which
   * changed for the same reason.
   */
  description: React.ReactNode;
}

// FIX: props were completely ignored — description prop now renders properly
const RInfo: React.FC<RewardInfoProps> = ({ title, description }) => {
  return (
    <Box sx={{ textAlign: "center", py: 2 }}>
      {/* Item image placeholder — swap src when assets are ready */}
      <Box
        sx={{
          height: { xs: "30vh", sm: "45vh" },
          bgcolor: "#d3d3d3",
          // FIX: was width:'60vw' marginLeft:'20vw' — not centered on all screens
          width: { xs: "90%", sm: "65%" },
          mx: "auto",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="text.secondary" fontWeight={700}>
          Item Image
        </Typography>
      </Box>

      {title && (
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ mt: 2.5, mx: { xs: 2, sm: "10%", md: "15%" } }}
        >
          {title}
        </Typography>
      )}

      {/*
        FIX: renders the description prop, not hardcoded text.
        A Box rather than a Typography because rich text renders block elements,
        which cannot legally nest inside the <p> a Typography emits.
      */}
      <Box
        sx={{
          mt: 1.5,
          mx: { xs: 2, sm: "10%", md: "15%" },
          lineHeight: 1.65,
          color: "text.secondary",
          textAlign: "left",
        }}
      >
        {description}
      </Box>
    </Box>
  );
};

export default RInfo;