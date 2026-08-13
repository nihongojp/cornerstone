"use client";

import React from "react";
import { Box, Typography } from "@mui/material";

interface RewardInfoProps {
  title: string;
  description: string;
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

      {/* FIX: renders the description prop, not hardcoded text */}
      <Typography
        variant="body1"
        sx={{
          mt: 1.5,
          mx: { xs: 2, sm: "10%", md: "15%" },
          lineHeight: 1.65,
          color: "text.secondary",
        }}
      >
        {description}
      </Typography>
    </Box>
  );
};

export default RInfo;