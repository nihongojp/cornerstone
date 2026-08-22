"use client";

import React, { useRef, useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { ChoiceCandidate } from "@/utils/buildChoiceOptions";
import { buildChoiceOptions } from "@/utils/buildChoiceOptions";

const BRAND = "#B43D20";

export interface MatchAudioItem {
  number?: number;
  phrase: string;
  audioUrl?: string;
  imageUrl?: string;
  // Other terms learned since the last checkpoint (or since the start of the
  // lesson) — the pool the 2 wrong-answer images are drawn from.
  checkpointPool?: ChoiceCandidate[];
}

interface Props {
  item: MatchAudioItem;
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
}

function isPlaceholder(url?: string) {
  return !url || url.toUpperCase().includes("PLACEHOLDER");
}

// The correct term plus up to 2 random, DISTINCT distractors from the
// checkpoint pool, in a freshly randomised order — recomputed every time the
// exercise is presented (see the useState lazy initializer below), not
// derived from the phrase. See buildChoiceOptions for the shared selection
// logic (also used by DragDropPlaceholder).
function buildChoices(item: MatchAudioItem): ChoiceCandidate[] {
  const correct: ChoiceCandidate = { phrase: item.phrase, imageUrl: item.imageUrl };
  return buildChoiceOptions(correct, item.checkpointPool ?? [], 2);
}

const MatchAudioExercisePlaceholder: React.FC<Props> = ({ item, onResult }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);

  const hasAudio = !isPlaceholder(item.audioUrl);

  const playAudio = () => {
    if (!hasAudio || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    setPlaying(true);
    audioRef.current.play().catch(() => setPlaying(false));
  };

  // Computed once when this exercise is first presented (lazy initializer —
  // never recomputed on re-render), so the correct answer's position and the
  // 2 distractors are freshly randomised every time the exercise is shown.
  const [choices] = useState<ChoiceCandidate[]>(() => buildChoices(item));

  const handleChoice = (choice: ChoiceCandidate) => {
    if (selected || wrongFlash) return;
    if (choice.phrase === item.phrase) {
      setSelected(choice.phrase);
      onResult?.({ result: "correct", detail: { chosen: choice.phrase, correct: item.phrase } });
    } else {
      setWrongFlash(choice.phrase);
      onResult?.({ result: "incorrect", detail: { chosen: choice.phrase, correct: item.phrase } });
      setTimeout(() => setWrongFlash(null), 1000);
    }
  };

  const getState = (choice: ChoiceCandidate) => {
    if (selected && choice.phrase === item.phrase) return "correct";
    if (wrongFlash === choice.phrase) return "wrong";
    return "idle";
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 520,
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

      {/* Audio button */}
      {hasAudio && (
        <audio
          ref={audioRef}
          src={item.audioUrl}
          preload="auto"
          onEnded={() => setPlaying(false)}
        />
      )}
      <Box
        onClick={playAudio}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          cursor: hasAudio ? "pointer" : "default",
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            bgcolor: hasAudio ? BRAND : "rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: playing
              ? "0 0 0 0 transparent"
              : hasAudio
              ? "0 4px 16px rgba(180,61,32,0.35)"
              : "none",
            animation: playing ? "audioPulse 1.2s ease-in-out infinite" : "none",
            "@keyframes audioPulse": {
              "0%,100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.4)" },
              "50%": { boxShadow: "0 0 0 16px rgba(180,61,32,0)" },
            },
            transition: "box-shadow 0.3s",
          }}
        >
          {playing
            ? <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: "2rem" }} />
            : <VolumeUpRoundedIcon sx={{ color: hasAudio ? "#fff" : "rgba(0,0,0,0.3)", fontSize: "2rem" }} />}
        </Box>

        {/* Phrase label — small, below audio button */}
        <Typography
          sx={{ fontSize: "0.78rem", fontWeight: 700, color: "text.secondary", letterSpacing: "0.02em" }}
        >
          {item.phrase}
        </Typography>
      </Box>

      {/* Prompt */}
      <Typography
        sx={{ fontWeight: 700, fontSize: "0.92rem", color: "#1C1917" }}
      >
        Which situation matches this phrase?
      </Typography>

      {/* Three image choice buttons */}
      <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, width: "100%", justifyContent: "center" }}>
        {choices.map((choice, i) => {
          const state = getState(choice);
          const hasImg = !isPlaceholder(choice.imageUrl);

          return (
            <Box
              key={i}
              onClick={() => !selected && handleChoice(choice)}
              sx={{
                flex: 1,
                maxWidth: 150,
                aspectRatio: "1",
                borderRadius: "16px",
                border: `3px solid ${
                  state === "correct" ? "#059669"
                  : state === "wrong" ? "#DC2626"
                  : "rgba(0,0,0,0.1)"
                }`,
                bgcolor:
                  state === "correct" ? "rgba(5,150,105,0.06)"
                  : state === "wrong" ? "rgba(220,38,38,0.06)"
                  : "#FAFAFA",
                cursor: selected ? "default" : "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                position: "relative",
                overflow: "hidden",
                transition: "border-color 0.2s, background-color 0.2s, transform 0.15s",
                "&:hover": selected ? {} : {
                  borderColor: BRAND,
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                },
              }}
            >
              {hasImg ? (
                <Box
                  component="img"
                  src={choice.imageUrl}
                  alt={choice.phrase}
                  sx={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                />
              ) : (
                <>
                  <ImageRoundedIcon sx={{ fontSize: "2rem", color: "rgba(0,0,0,0.18)" }} />
                  <Typography sx={{ fontSize: "0.65rem", color: "text.disabled", textAlign: "center", px: 0.5 }}>
                    Image soon
                  </Typography>
                </>
              )}

              {/* Result overlay */}
              {state !== "idle" && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: state === "correct" ? "rgba(5,150,105,0.15)" : "rgba(220,38,38,0.15)",
                    borderRadius: "13px",
                  }}
                >
                  {state === "correct"
                    ? <CheckRoundedIcon sx={{ fontSize: "2.5rem", color: "#059669" }} />
                    : <CloseRoundedIcon sx={{ fontSize: "2.5rem", color: "#DC2626" }} />}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {selected && (
        <Typography
          sx={{ fontWeight: 700, fontSize: "0.92rem", color: "#059669" }}
        >
          ✓ Correct!
        </Typography>
      )}
    </Box>
  );
};

export default MatchAudioExercisePlaceholder;
