import React, { useMemo, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";

type ResultCb = (r: { result: "correct" | "incorrect"; detail?: any }) => void;

type AudioMatchProps = {
  onResult?: ResultCb;
  options: string[];
  correctAnswer: string;
  audioUrl?: string;
  prompt?: string;
};

const AudioMatch: React.FC<AudioMatchProps> = ({
  onResult,
  options,
  correctAnswer,
  audioUrl,
  prompt,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  // Deduped defensively — callers should already pass unique options, but a
  // duplicate here would otherwise render two identical, independently-
  // clickable answer buttons.
  const choices = useMemo(() => Array.from(new Set(options ?? [])), [options]);

  const play = () => {
    if (!audioUrl || !audioRef.current) return;
    const audio = audioRef.current;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    audio.currentTime = 0;
    setPlaying(true);
    setPlayCount((c) => c + 1);
    audio.play().catch((e) => {
      console.error("Audio playback failed:", e);
      setPlaying(false);
    });
  };

  const choose = (label: string) => {
    if (selected) return;
    setSelected(label);
    onResult?.({
      result: label === correctAnswer ? "correct" : "incorrect",
      detail: { choice: label, correct: correctAnswer },
    });
  };

  // Only the choice the learner actually clicked changes color — never
  // reveal which one was correct until they've picked it themselves.
  const getButtonState = (label: string) => {
    if (!selected || label !== selected) return "idle";
    return label === correctAnswer ? "correct" : "wrong";
  };

  return (
    <Box sx={{ textAlign: "center", width: "100%", maxWidth: 560, mx: "auto", px: { xs: 0.5, sm: 1 } }}>
      <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, mb: 0.5, color: "#1C1917" }}>
        {prompt || "Listen and choose the right character"}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {playCount === 0 ? "Press play to hear the audio." : "Choose the character you heard."}
      </Typography>

      {/* Audio player */}
      {audioUrl ? (
        <Box sx={{ mb: 2 }}>
          <audio ref={audioRef} src={audioUrl} preload="auto" />
          <Box
            onClick={!playing ? play : undefined}
            sx={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              cursor: playing ? "default" : "pointer",
              px: 4,
              py: 2,
              borderRadius: "20px",
              bgcolor: playing ? "rgba(180,61,32,0.08)" : "rgba(180,61,32,0.06)",
              border: `2px solid ${playing ? "#B43D20" : "rgba(180,61,32,0.2)"}`,
              transition: "all 0.2s",
              "&:hover": !playing ? { bgcolor: "rgba(180,61,32,0.1)", borderColor: "#B43D20", transform: "scale(1.02)" } : {},
            }}
          >
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                bgcolor: "#B43D20",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: playing ? "0 0 0 10px rgba(180,61,32,0.1), 0 0 0 20px rgba(180,61,32,0.05)" : "0 4px 16px rgba(180,61,32,0.35)",
                transition: "box-shadow 0.3s",
                animation: playing ? "pulse 1.2s ease-in-out infinite" : "none",
                "@keyframes pulse": {
                  "0%, 100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.4)" },
                  "50%": { boxShadow: "0 0 0 16px rgba(180,61,32,0)" },
                },
              }}
            >
              {playing ? (
                <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: "1.8rem" }} />
              ) : (
                <VolumeUpRoundedIcon sx={{ color: "#fff", fontSize: "1.8rem" }} />
              )}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#B43D20" }}>
              {playing ? "Playing…" : playCount > 0 ? "Play again" : "Play audio"}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            py: 2,
            px: 4,
            mb: 2,
            borderRadius: "16px",
            bgcolor: "rgba(0,0,0,0.03)",
            border: "1px dashed rgba(0,0,0,0.15)",
          }}
        >
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            🔇 No audio available for this exercise.
          </Typography>
        </Box>
      )}

      {/* Choice buttons */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          justifyContent: "center",
        }}
      >
        {choices.map((c) => {
          const state = getButtonState(c);
          return (
            <Button
              key={c}
              variant={state !== "idle" ? "contained" : "outlined"}
              onClick={() => choose(c)}
              disabled={!!selected && state === "idle"}
              sx={{
                minWidth: { xs: 100, sm: 130 },
                height: { xs: 76, sm: 92 },
                fontSize: { xs: "1.5rem", sm: "1.8rem" },
                fontWeight: 600,
                borderRadius: "16px",
                border: `2px solid ${state === "correct" ? "#059669" : state === "wrong" ? "#DC2626" : "rgba(0,0,0,0.12)"}`,
                bgcolor:
                  state === "correct"
                    ? "#059669"
                    : state === "wrong"
                    ? "#DC2626"
                    : "#fff",
                color: state !== "idle" ? "#fff" : "#1C1917",
                boxShadow: state === "correct" ? "0 4px 16px rgba(5,150,105,0.35)" : state === "wrong" ? "0 4px 16px rgba(220,38,38,0.25)" : "0 1px 4px rgba(0,0,0,0.06)",
                transition: "all 0.2s",
                "&:hover": selected
                  ? {}
                  : {
                      borderColor: "#B43D20",
                      bgcolor: "rgba(180,61,32,0.04)",
                      transform: "translateY(-2px)",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    },
                "&.Mui-disabled": {
                  opacity: 0.35,
                },
              }}
            >
              {c.replace("/", " / ")}
            </Button>
          );
        })}
      </Box>

      {/* Result hint */}
      {selected && (
        <Typography
          sx={{
            mt: 2,
            fontWeight: 700,
            fontSize: "0.95rem",
            color: selected === correctAnswer ? "#059669" : "#DC2626",
          }}
        >
          {selected === correctAnswer ? "✓ Correct!" : "✗ Not quite — try again."}
        </Typography>
      )}
    </Box>
  );
};

export default AudioMatch;