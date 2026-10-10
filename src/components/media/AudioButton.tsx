"use client";

import React, { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

const BRAND = "#B43D20";

/*
 * The small red round play button — the one audio control for term and dialogue
 * audio, so every screen that plays a clip looks the same. `speed` is read at
 * the moment of each play, so changing it takes effect on the next press rather
 * than restarting a clip that is already running.
 */
export const AudioButton: React.FC<{
  src: string;
  /** Diameter in px. */
  size?: number;
  speed?: number;
  label?: string;
}> = ({ src, size = 32, speed = 1, label = "Play pronunciation" }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // A clip left playing would carry on over the next screen.
  useEffect(() => () => audioRef.current?.pause(), []);

  const play = (event: React.MouseEvent) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.playbackRate = speed;
    setPlaying(true);
    audio.play().catch(() => setPlaying(false));
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => setPlaying(false)}
      />
      <Box
        onClick={play}
        role="button"
        aria-label={label}
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          bgcolor: BRAND,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(180,61,32,0.35)",
          animation: playing ? "audioButtonPulse 1.2s ease-in-out infinite" : "none",
          "@keyframes audioButtonPulse": {
            "0%,100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.4)" },
            "50%": { boxShadow: "0 0 0 8px rgba(180,61,32,0)" },
          },
          transition: "box-shadow 0.3s",
          flexShrink: 0,
        }}
      >
        {playing ? (
          <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: size * 0.5 }} />
        ) : (
          <VolumeUpRoundedIcon sx={{ color: "#fff", fontSize: size * 0.5 }} />
        )}
      </Box>
    </>
  );
};

export default AudioButton;
