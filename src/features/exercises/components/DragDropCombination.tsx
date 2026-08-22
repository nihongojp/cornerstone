"use client";

import React, { useMemo, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import ImageNotSupportedRoundedIcon from "@mui/icons-material/ImageNotSupportedRounded";
import SelfRecordButton from "./SelfRecordButton";

// Grammar-lesson drag-and-drop: build the correct word/phrase by dragging
// several word-fragment tiles, in order, into ONE shared drop box (not a
// fixed box per expected piece — the box just grows as tiles are added).
// Tiles size themselves to their own text (padding-based, no fixed
// width/height), since fragments vary a lot in length ("ha" vs "arigatou").
type DragPayload = { source: "bank" | "box"; index: number };

type Props = {
  prompt?: string;
  imageUrl?: string;
  audioUrl?: string;
  options: string[];
  correctSequence: string[];
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
};

const DragDropCombination: React.FC<Props> = ({
  prompt = "Drag the tiles into the correct order",
  imageUrl,
  audioUrl,
  options,
  correctSequence,
  onResult,
}) => {
  const resolvedImageUrl = String(imageUrl || "").trim();

  const [placedIndices, setPlacedIndices] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [boxDragOver, setBoxDragOver] = useState(false);
  const [bankDragOver, setBankDragOver] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  const dragPayloadRef = useRef<DragPayload | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const placedTiles = placedIndices.map((i) => options[i]);
  const isComplete = placedIndices.length === correctSequence.length;
  const isCorrect = useMemo(
    () =>
      isComplete &&
      placedTiles.every(
        (t, i) => t.trim().toLowerCase() === (correctSequence[i] ?? "").trim().toLowerCase()
      ),
    [placedTiles, correctSequence, isComplete]
  );
  const showAudio = checked && isCorrect && Boolean(audioUrl);

  const bankIndices = options.map((_, i) => i).filter((i) => !placedIndices.includes(i));

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, source: "bank" | "box", index: number) => {
    const payload: DragPayload = { source, index };
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

  // Moves the dragged tile (from the bank, or already in the box) so it ends
  // up at `targetPos` within the placed sequence — this is what actually
  // lets you reorder tiles you've already placed, not just append/remove.
  const moveToPosition = (payload: DragPayload, targetPos: number) => {
    setChecked(false);
    setPlacedIndices((prev) => {
      const next = [...prev];
      let pos = targetPos;
      if (payload.source === "box") {
        const fromPos = next.indexOf(payload.index);
        if (fromPos === -1) return next;
        next.splice(fromPos, 1);
        if (fromPos < pos) pos -= 1;
      }
      pos = Math.max(0, Math.min(pos, next.length));
      next.splice(pos, 0, payload.index);
      return next;
    });
  };

  const onDropBox = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBoxDragOver(false);
    const payload = readPayload(e);
    if (!payload) return;
    // Dropped on the box's own background (not on a specific tile) — treat
    // as "put it at the end."
    moveToPosition(payload, placedIndices.length);
  };

  // Dropped directly on an already-placed tile — insert the dragged tile
  // right before this one, reordering as needed.
  const onDropOnTile = (e: React.DragEvent<HTMLDivElement>, beforeIndexInPlaced: number) => {
    e.preventDefault();
    e.stopPropagation();
    setBoxDragOver(false);
    const payload = readPayload(e);
    if (!payload) return;
    moveToPosition(payload, beforeIndexInPlaced);
  };

  const onDropBank = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBankDragOver(false);
    const payload = readPayload(e);
    if (!payload || payload.source !== "box") return;
    setChecked(false);
    setPlacedIndices((prev) => prev.filter((i) => i !== payload.index));
  };

  const removeTile = (index: number) => {
    setChecked(false);
    setPlacedIndices((prev) => prev.filter((i) => i !== index));
  };

  const handleCheck = () => {
    if (!isComplete) return;
    setChecked(true);
    onResult?.({
      result: isCorrect ? "correct" : "incorrect",
      detail: { placed: placedTiles, correct: correctSequence },
    });
  };

  const reset = () => {
    setPlacedIndices([]);
    setChecked(false);
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

      {/* Prompt image */}
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

      {/* Reference audio — hidden until the user presses Check and the
          sequence is correct, as positive reinforcement. */}
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

      {/* Single long drop target — holds the ordered sequence of placed
          tiles, growing to fit them instead of showing per-piece boxes. */}
      <Box
        role="button"
        aria-label="Drop the tiles here in order"
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
          border: `2px ${placedIndices.length ? "solid" : "dashed"} ${
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
          flexWrap: "wrap",
          justifyContent: placedIndices.length ? "flex-start" : "center",
          gap: 1,
          px: 2,
          py: 1.5,
          transition: "border-color 0.2s, background-color 0.2s",
          boxShadow: boxDragOver ? "0 0 0 4px rgba(96,165,250,0.2)" : "none",
        }}
      >
        {placedIndices.length === 0 ? (
          <Typography sx={{ color: "text.disabled", fontSize: "0.9rem", userSelect: "none" }}>
            Drop the words here in order…
          </Typography>
        ) : (
          placedIndices.map((idx, pos) => (
            <Box
              key={`placed-${idx}`}
              draggable
              onDragStart={(e) => onDragStart(e, "box", idx)}
              onDoubleClick={() => removeTile(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBoxDragOver(true);
              }}
              onDrop={(e) => onDropOnTile(e, pos)}
              title="Drag out, drag onto another tile to reorder, or double-click to remove"
              sx={{
                px: 2,
                py: 1,
                borderRadius: "10px",
                border: `2px solid ${checked ? (isCorrect ? "#059669" : "#DC2626") : "rgba(0,0,0,0.15)"}`,
                bgcolor: checked ? (isCorrect ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)") : "#F9F7F4",
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                fontWeight: 700,
                whiteSpace: "nowrap",
                cursor: "grab",
                userSelect: "none",
                color: checked ? (isCorrect ? "#065F46" : "#7F1D1D") : "inherit",
              }}
            >
              {options[idx]}
            </Box>
          ))
        )}
      </Box>

      {/* Bank — remaining, not-yet-placed tiles */}
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
        {bankIndices.map((idx) => (
          <Box
            key={`bank-${idx}`}
            draggable
            onDragStart={(e) => onDragStart(e, "bank", idx)}
            title="Drag to the box above"
            sx={{
              px: 2.5,
              py: 1.25,
              border: "2px solid rgba(0,0,0,0.1)",
              borderRadius: "12px",
              cursor: "grab",
              fontSize: { xs: "0.95rem", sm: "1.05rem" },
              fontWeight: 700,
              whiteSpace: "nowrap",
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
            {options[idx]}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
        <Box
          component="button"
          onClick={handleCheck}
          disabled={!isComplete}
          sx={{
            px: 3,
            py: 1.25,
            borderRadius: 999,
            border: "none",
            bgcolor: isComplete ? "#B43D20" : "rgba(0,0,0,0.08)",
            color: isComplete ? "#fff" : "rgba(0,0,0,0.35)",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: isComplete ? "pointer" : "default",
            transition: "all 0.2s",
            boxShadow: isComplete ? "0 4px 14px rgba(180,61,32,0.35)" : "none",
            "&:hover": isComplete ? { bgcolor: "#9D351C" } : {},
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
        <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: isCorrect ? "#059669" : "#DC2626" }}>
          {isCorrect ? "✓ Correct!" : "✗ Not quite — try again."}
        </Typography>
      )}
    </Box>
  );
};

export default DragDropCombination;
