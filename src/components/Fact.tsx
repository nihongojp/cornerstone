"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";

interface FactProps {
  title: string;
  description: string;
  imageUrl?: string; // optional — no hardcoded fallback
  imageAlt?: string;
}

const Fact: React.FC<FactProps> = ({ title, description, imageUrl, imageAlt }) => {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 560,
        mx: "auto",
        px: { xs: 1, sm: 2 },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2.5,
      }}
    >
      {/* Fact card */}
      <Box
        sx={{
          width: "100%",
          borderRadius: "20px",
          border: "1px solid rgba(0,0,0,0.08)",
          bgcolor: "#FFFFFF",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Header band */}
        <Box
          sx={{
            px: 3,
            py: 1.75,
            bgcolor: "rgba(180,61,32,0.05)",
            borderBottom: "1px solid rgba(180,61,32,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 1.25,
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "10px",
              bgcolor: "#B43D20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <LightbulbRoundedIcon sx={{ color: "#fff", fontSize: "1.1rem" }} />
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: "0.9rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#B43D20",
            }}
          >
            {title}
          </Typography>
        </Box>

        {/* Body */}
        <Box sx={{ px: { xs: 2.5, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
          <Typography
            sx={{
              fontSize: { xs: "1rem", sm: "1.1rem" },
              lineHeight: 1.7,
              color: "#374151",
            }}
          >
            {description}
          </Typography>
        </Box>
      </Box>

      {/* Optional image */}
      {imageUrl && (
        <Box
          component="img"
          src={imageUrl}
          alt={imageAlt || title}
          sx={{
            height: { xs: "18vh", sm: "26vh" },
            maxHeight: 220,
            objectFit: "contain",
            borderRadius: "12px",
          }}
        />
      )}

      {/* Decorative mascot fallback if no image */}
      {!imageUrl && (
        <Box
          sx={{
            fontSize: { xs: "4rem", sm: "5rem" },
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          🐱
        </Box>
      )}
    </Box>
  );
};

export default Fact;