"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import ImageNotSupportedRoundedIcon from "@mui/icons-material/ImageNotSupportedRounded";
import { ChoiceCandidate } from "../utils/expandLessonItems";
import { buildChoiceOptions } from "../utils/buildChoiceOptions";
import SelfRecordButton from "./SelfRecordButton";

// Grammar-lesson (newlessons) drag-and-drop exercise: shows the term's image
// as the prompt, and the learner drags the matching romanized-reading tile
// (from up to 4 options — the correct term plus distinct distractors from
// checkpointPool) into a single long drop target. Unlike the reading/writing
// lesson's DragDrop (components/DragDrop.tsx), there is no per-answer slot
// box, since only one tile is ever expected here.
type DragPayload = { phrase: string };

type DragDropPlaceholderProps = {
  prompt?: string;
  imageUrl?: string;
  audioUrl?: string;
  correctPhrase: string;
  checkpointPool?: ChoiceCandidate[];
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
};

const DragDropPlaceholder: React.FC<DragDropPlaceholderProps> = ({
  prompt = "Which word matches this image?",
  imageUrl,
  audioUrl,
  correctPhrase,
  checkpointPool,
  onResult,
}) => {
  const resolvedImageUrl = String(imageUrl || "").trim();

  // Correct tile + up to 3 distinct distractors, computed once per
  // presentation (lazy initializer — never recomputed on re-render) so the
  // set and order are fresh every time this exercise is shown.
  const [choices] = useState<ChoiceCandidate[]>(() =>
    buildChoiceOptions({ phrase: correctPhrase }, checkpointPool ?? [], 3)
  );

  const [placedPhrase, setPlacedPhrase] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [boxDragOver, setBoxDragOver] = useState(false);
  const [bankDragOver, setBankDragOver] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  const dragPayloadRef = useRef<DragPayload | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedImageUrl]);

  const isCorrect = useMemo(
    () => placedPhrase !== null && placedPhrase.trim().toLowerCase() === correctPhrase.trim().toLowerCase(),
    [placedPhrase, correctPhrase]
  );

  // Audio is never shown as an upfront hint here — reveal it under the
  // image only after the learner presses Check and the answer is correct.
  const showAudio = checked && isCorrect && Boolean(audioUrl);

  const bankTiles = choices.filter((c) => c.phrase !== placedPhrase);

  const onDragStartTile = (e: React.DragEvent<HTMLDivElement>, phrase: string) => {
    const payload: DragPayload = { phrase };
    dragPayloadRef.current = payload;
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const readPayload = (e: React.DragEvent<HTMLDivElement>): DragPayload | null => {
    try {
      const raw = e.dataTransfer.getData("application/json") || JSON.stringify(dragPayloadRef.current);
      return raw ? (JSON.parse(raw) as DragPayload) : null;
    } catch {
      return null;
    }
  };

  // Dropping any tile onto the box places it, replacing whatever was there
  // before — only one tile is ever expected, so there's no need to track a
  // fixed number of slots.
  const onDropBox = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBoxDragOver(false);
    const payload = readPayload(e);
    if (!payload) return;
    setChecked(false);
    setPlacedPhrase(payload.phrase);
  };

  const onDropBank = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBankDragOver(false);
    const payload = readPayload(e);
    if (!payload || payload.phrase !== placedPhrase) return;
    setChecked(false);
    setPlacedPhrase(null);
  };

  const removePlaced = () => {
    setChecked(false);
    setPlacedPhrase(null);
  };

  const handleCheck = () => {
    if (placedPhrase === null) return;
    setChecked(true);
    onResult?.({
      result: isCorrect ? "correct" : "incorrect",
      detail: { placed: placedPhrase, correct: correctPhrase },
    });
  };

  const reset = () => {
    setPlacedPhrase(null);
    setChecked(false);
    setBoxDragOver(false);
  };

  const play = () => {
    if (!audioUrl || !audioRef.current) return;
    const audio = audioRef.current;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    audio.currentTime = 0;
    setPlaying(true);
    audio.play().catch(() => setPlaying(false));
  };

  const shouldShowImage = Boolean(resolvedImageUrl && !imageFailed);

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 680,
        mx: "auto",
        px: { xs: 0.5, sm: 1 },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.25,
      }}
    >
      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, color: "#1C1917" }}>
          {prompt}
        </Typography>
      </Box>

      {/* Prompt image — the exercise's primary cue */}
      <Box
        sx={{
          width: { xs: 148, sm: 180 },
          height: { xs: 148, sm: 180 },
          borderRadius: "18px",
          bgcolor: "#F3F4F6",
          border: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          boxShadow: shouldShowImage ? "0 8px 24px rgba(0,0,0,0.08)" : "none",
        }}
      >
        {shouldShowImage ? (
          <Box
            component="img"
            src={resolvedImageUrl}
            alt={prompt}
            onError={() => setImageFailed(true)}
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
              color: "text.secondary",
            }}
          >
            <ImageNotSupportedRoundedIcon sx={{ fontSize: { xs: 42, sm: 50 }, opacity: 0.75 }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              No image
            </Typography>
          </Box>
        )}
      </Box>

      {/* Reference audio — under the image after a correct Check */}
      {showAudio && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexDirection: "column" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <audio ref={audioRef} src={audioUrl} preload="auto" />
            <IconButton
              onClick={play}
              disabled={playing}
              aria-label="Play reference audio"
              sx={{
                width: 52,
                height: 52,
                bgcolor: playing ? "rgba(180,61,32,0.08)" : "#B43D20",
                color: playing ? "#B43D20" : "#fff",
                border: playing ? "2px solid #B43D20" : "none",
                "&:hover": { bgcolor: playing ? "rgba(180,61,32,0.12)" : "#9D351C" },
                "&.Mui-disabled": { bgcolor: "rgba(180,61,32,0.2)", color: "#B43D20" },
                transition: "all 0.2s",
                boxShadow: playing ? "none" : "0 4px 14px rgba(180,61,32,0.35)",
              }}
            >
              {playing ? <GraphicEqRoundedIcon /> : <VolumeUpRoundedIcon />}
            </IconButton>
            <SelfRecordButton />
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
            Hear the reference pronunciation
          </Typography>
        </Box>
      )}

      {/* Single long drop target — holds at most one tile; no per-answer
          slots, since only one correct tile is ever expected. */}
      <Box
        role="button"
        aria-label="Drop the matching word here"
        onDragOver={(e) => {
          e.preventDefault();
          setBoxDragOver(true);
        }}
        onDragLeave={() => setBoxDragOver(false)}
        onDrop={onDropBox}
        sx={{
          width: "100%",
          minHeight: 64,
          borderRadius: "14px",
          border: `2px ${placedPhrase ? "solid" : "dashed"} ${
            boxDragOver
              ? "#60A5FA"
              : checked
                ? (isCorrect ? "#059669" : "#DC2626")
                : "rgba(0,0,0,0.2)"
          }`,
          bgcolor: checked
            ? (isCorrect ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)")
            : boxDragOver
              ? "rgba(96,165,250,0.08)"
              : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 1.5,
          transition: "border-color 0.2s, background-color 0.2s",
          boxShadow: boxDragOver ? "0 0 0 4px rgba(96,165,250,0.2)" : "none",
        }}
      >
        {placedPhrase === null ? (
          <Typography sx={{ color: "text.disabled", fontSize: "0.9rem", userSelect: "none" }}>
            Drop the matching word here…
          </Typography>
        ) : (
          <Box
            draggable
            onDragStart={(e) => onDragStartTile(e, placedPhrase)}
            onDoubleClick={removePlaced}
            title="Drag out, or double-click to remove"
            sx={{
              px: 2.5,
              py: 1,
              borderRadius: "10px",
              border: `2px solid ${
                checked ? (isCorrect ? "#059669" : "#DC2626") : "rgba(0,0,0,0.15)"
              }`,
              bgcolor: checked
                ? (isCorrect ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)")
                : "#F9F7F4",
              fontSize: { xs: "1rem", sm: "1.1rem" },
              fontWeight: 700,
              cursor: "grab",
              userSelect: "none",
              color: checked ? (isCorrect ? "#065F46" : "#7F1D1D") : "inherit",
            }}
          >
            {placedPhrase}
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 1.25,
          p: 1.5,
          borderRadius: "14px",
          bgcolor: bankDragOver ? "rgba(96,165,250,0.08)" : "#F9F7F4",
          border: `1px solid ${bankDragOver ? "#60A5FA" : "rgba(0,0,0,0.08)"}`,
          minHeight: 76,
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
          transition: "border-color 0.2s, background-color 0.2s",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setBankDragOver(true);
        }}
        onDragLeave={() => setBankDragOver(false)}
        onDrop={onDropBank}
      >
        {bankTiles.map((choice) => (
          <Box
            key={choice.phrase}
            draggable
            onDragStart={(e) => onDragStartTile(e, choice.phrase)}
            title="Drag to the box above"
            sx={{
              px: 2.5,
              py: 1.25,
              border: "2px solid rgba(0,0,0,0.1)",
              borderRadius: "12px",
              cursor: "grab",
              fontSize: { xs: "1rem", sm: "1.1rem" },
              fontWeight: 700,
              userSelect: "none",
              bgcolor: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                borderColor: "#B43D20",
              },
            }}
          >
            {choice.phrase}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
        <Box
          component="button"
          onClick={handleCheck}
          disabled={placedPhrase === null}
          sx={{
            px: 3,
            py: 1.25,
            borderRadius: 999,
            border: "none",
            bgcolor: placedPhrase !== null ? "#B43D20" : "rgba(0,0,0,0.08)",
            color: placedPhrase !== null ? "#fff" : "rgba(0,0,0,0.35)",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: placedPhrase !== null ? "pointer" : "default",
            transition: "all 0.2s",
            boxShadow: placedPhrase !== null ? "0 4px 14px rgba(180,61,32,0.35)" : "none",
            "&:hover": placedPhrase !== null ? { bgcolor: "#9D351C" } : {},
          }}
        >
          Check
        </Box>

        <Box
          component="button"
          onClick={reset}
          sx={{
            px: 3,
            py: 1.25,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.15)",
            bgcolor: "#fff",
            color: "#6B7280",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            transition: "all 0.2s",
            "&:hover": { bgcolor: "#F9F7F4" },
          }}
        >
          Reset
        </Box>
      </Box>

      {checked && (
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "0.95rem",
            color: isCorrect ? "#059669" : "#DC2626",
          }}
        >
          {isCorrect ? "✓ Correct!" : "✗ Not quite — try again."}
        </Typography>
      )}
    </Box>
  );
};

export default DragDropPlaceholder;
