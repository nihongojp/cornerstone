import React, { useMemo, useRef, useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

const BRAND = "#B43D20";

export interface MatchAudioItem {
  number?: number;
  phrase: string;
  audioUrl?: string;
  imageUrl?: string;
}

interface Props {
  item: MatchAudioItem;
  allItems: MatchAudioItem[];
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
}

function isPlaceholder(url?: string) {
  return !url || url.toUpperCase().includes("PLACEHOLDER");
}

// Deterministic position for the correct answer based on phrase content,
// so each exercise has a different correct-button position.
function correctPosition(phrase: string): number {
  let hash = 0;
  for (let i = 0; i < phrase.length; i++) {
    hash = (hash * 31 + phrase.charCodeAt(i)) & 0xffff;
  }
  return hash % 3;
}

// Seeded shuffle — stable across renders for the same phrase.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const MatchAudioExercisePlaceholder: React.FC<Props> = ({ item, allItems, onResult }) => {
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

  // Build 3 choices: correct + 2 distractors, correct at deterministic position.
  const choices = useMemo(() => {
    const distractorPool = allItems.filter((a) => a.phrase !== item.phrase);
    const seed = item.phrase.split("").reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0);
    const shuffled = seededShuffle(distractorPool, seed);
    const distractors = shuffled.slice(0, 2);

    const pos = correctPosition(item.phrase);
    const result: MatchAudioItem[] = [...distractors];
    result.splice(pos, 0, item);
    // Pad with current item if not enough distractors
    while (result.length < 3) result.push(item);
    return result;
  }, [item, allItems]);

  const handleChoice = (choice: MatchAudioItem) => {
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

  const getState = (choice: MatchAudioItem) => {
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
