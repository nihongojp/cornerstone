"use client";

import React from "react";
import { Box } from "@mui/material";

const BRAND = "#B43D20";

export const AUDIO_SPEEDS = [0.5, 0.75, 1, 1.25] as const;
export type AudioSpeed = (typeof AUDIO_SPEEDS)[number];

/** Applied on the next play — changing it mid-playback would otherwise
 *  require restarting the clip to hear the new rate. */
export const AudioSpeedControl: React.FC<{
  speed: number;
  onChange: (speed: AudioSpeed) => void;
}> = ({ speed, onChange }) => (
  <Box sx={{ display: "flex", gap: 0.5 }}>
    {AUDIO_SPEEDS.map((s) => (
      <Box
        key={s}
        role="button"
        aria-label={`Play at ${s} times speed`}
        onClick={() => onChange(s)}
        sx={{
          px: 0.75,
          py: 0.25,
          borderRadius: "999px",
          fontSize: "0.65rem",
          fontWeight: 700,
          cursor: "pointer",
          userSelect: "none",
          color: speed === s ? "#fff" : "text.secondary",
          bgcolor: speed === s ? BRAND : "rgba(0,0,0,0.06)",
          transition: "background-color 0.15s, color 0.15s",
        }}
      >
        {s}x
      </Box>
    ))}
  </Box>
);

export default AudioSpeedControl;
