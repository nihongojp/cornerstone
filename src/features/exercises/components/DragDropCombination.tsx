"use client";

import React, { useEffect, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import ImageNotSupportedRoundedIcon from "@mui/icons-material/ImageNotSupportedRounded";

import { isCorrectPlacement, isTileCorrect } from "../dragDropPlacement";
import SelfRecordButton from "./SelfRecordButton";

// Grammar-lesson drag-and-drop: build the correct word/phrase by dragging
// several word-fragment tiles, in order, into ONE shared drop box (not a
// fixed box per expected piece — the box just grows as tiles are added).
// Tiles size themselves to their own text (padding-based, no fixed
// width/height), since fragments vary a lot in length ("ha" vs "arigatou").
//
// Bank tiles are reusable: `options` is the set of distinct tiles on offer,
// not one slot per placement. Dropping (or tapping) a bank tile adds a new,
// independently-identified copy of it to the box — it never gets removed
// from the bank — so an answer that repeats a character ("おおい") only
// needs one お in the bank, not two. Each placement therefore needs its own
// id distinct from `options`' index, since the same option can be placed
// more than once at once.
type Placement = { id: string; value: string };
type DragPayload = { source: "bank"; value: string } | { source: "box"; id: string };

type Props = {
  prompt?: string;
  imageUrl?: string;
  audioUrl?: string;
  options: string[];
  correctSequence: string[];
  /** A tile's own audio, by its displayed value. */
  tileAudio?: Record<string, string | undefined>;
  /*
   * "romaji" tiles are individual letters of a romanized word ("a", "ri",
   * "ga" …) — not a pronounceable unit worth its own audio button. Per-tile
   * audio is only offered for "asAuthored" tiles (actual kana/kanji), where
   * each one is a real term with its own recording.
   */
  tileScript?: "asAuthored" | "romaji";
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
};

const DragDropCombination: React.FC<Props> = ({
  prompt = "Drag the tiles into the correct order",
  imageUrl,
  audioUrl,
  options,
  correctSequence,
  tileAudio,
  tileScript,
  onResult,
}) => {
  const resolvedImageUrl = String(imageUrl || "").trim();

  const [placed, setPlaced] = useState<Placement[]>([]);
  const [checked, setChecked] = useState(false);
  const [boxDragOver, setBoxDragOver] = useState(false);
  const [bankDragOver, setBankDragOver] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  // One playing-tile key across bank and box tiles, namespaced so a bank
  // entry and an identically-valued placed tile never collide.
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const dragPayloadRef = useRef<DragPayload | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tileAudioRef = useRef<HTMLAudioElement | null>(null);
  const idCounterRef = useRef(0);
  const nextId = () => `t${idCounterRef.current++}`;

  const placedTiles = placed.map((p) => p.value);
  const isCorrect = isCorrectPlacement(placedTiles, correctSequence);
  const showResult = checked && isCorrect;
  const showAudio = showResult && Boolean(audioUrl);

  // Before checking, a tap edits the sequence (add/remove). After checking,
  // a tap instead plays that tile's own recording — the box itself becomes
  // the audio button, for every tile on offer, not just the ones placed and
  // not just the correct ones, so a learner can double-check any
  // pronunciation. Romaji-letter tiles never get this: a single letter
  // fragment has no pronunciation of its own to play.
  const canEdit = !checked;
  const tilesPlayAudio = checked && tileScript !== "romaji";

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, payload: DragPayload) => {
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

  // Moves the dragged tile so it ends up at `targetPos` in the placed
  // sequence. A tile coming from the bank is always a brand-new placement
  // (the bank copy is never consumed); a tile coming from the box is the
  // same placement, relocated — which is what lets you reorder tiles you've
  // already placed, not just append or remove them.
  const moveToPosition = (payload: DragPayload, targetPos: number) => {
    setChecked(false);
    setPlaced((prev) => {
      const next = [...prev];
      let pos = targetPos;
      let moving: Placement;
      if (payload.source === "box") {
        const fromPos = next.findIndex((p) => p.id === payload.id);
        if (fromPos === -1) return prev;
        [moving] = next.splice(fromPos, 1);
        if (fromPos < pos) pos -= 1;
      } else {
        moving = { id: nextId(), value: payload.value };
      }
      pos = Math.max(0, Math.min(pos, next.length));
      next.splice(pos, 0, moving);
      return next;
    });
  };

  const addTile = (value: string) => {
    setChecked(false);
    setPlaced((prev) => [...prev, { id: nextId(), value }]);
  };

  const removeTile = (id: string) => {
    setChecked(false);
    setPlaced((prev) => prev.filter((p) => p.id !== id));
  };

  const onDropBox = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBoxDragOver(false);
    const payload = readPayload(e);
    if (!payload) return;
    // Dropped on the box's own background (not on a specific tile) — treat
    // as "put it at the end."
    moveToPosition(payload, placed.length);
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

  // A box tile dragged back onto the bank just removes that placement — the
  // bank was never depleted when it was placed, so there is nothing to
  // "return."
  const onDropBank = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBankDragOver(false);
    const payload = readPayload(e);
    if (!payload || payload.source !== "box") return;
    removeTile(payload.id);
  };

  const handleCheck = () => {
    setChecked(true);
    onResult?.({
      result: isCorrect ? "correct" : "incorrect",
      detail: { placed: placedTiles, correct: correctSequence },
    });
  };

  const reset = () => {
    setPlaced([]);
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

  const playTileAudio = (key: string, value: string) => {
    const src = tileAudio?.[value];
    if (!src) return;
    tileAudioRef.current?.pause();
    const audio = new Audio(src);
    tileAudioRef.current = audio;
    audio.onended = () => setPlayingKey(null);
    audio.onerror = () => setPlayingKey(null);
    setPlayingKey(key);
    audio.play().catch(() => setPlayingKey(null));
  };

  // `playTileAudio` builds a detached `Audio` rather than rendering an
  // element, so unmounting this exercise does not stop it the way removing
  // the <audio> below does — without this, a tile plays on over the next
  // screen.
  useEffect(() => () => tileAudioRef.current?.pause(), []);

  const shouldShowImage = Boolean(resolvedImageUrl && !imageFailed);

  // Shared look for a tile, whether it's sitting in the bank or placed in
  // the box. `tone` carries the grading colors once checked; a bank tile
  // (never graded) always passes "idle".
  const tileSx = (tone: "idle" | "correct" | "wrong", interactive: boolean) => ({
    position: "relative" as const,
    px: 2,
    py: 1,
    borderRadius: "10px",
    border: `2px solid ${tone === "correct" ? "#059669" : tone === "wrong" ? "#DC2626" : "rgba(0,0,0,0.15)"}`,
    bgcolor: tone === "correct" ? "rgba(5,150,105,0.06)" : tone === "wrong" ? "rgba(220,38,38,0.06)" : "#F9F7F4",
    fontSize: { xs: "0.95rem", sm: "1.05rem" },
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    cursor: interactive ? "pointer" : "default",
    userSelect: "none" as const,
    color: tone === "correct" ? "#065F46" : tone === "wrong" ? "#7F1D1D" : "inherit",
  });

  // Small in-box icon that shows a tile has become an audio button, instead
  // of a separate button living outside the character box.
  const AudioCorner: React.FC<{ value: string; playingHere: boolean }> = ({ value, playingHere }) => {
    const hasAudio = Boolean(tileAudio?.[value]);
    return (
      <Box
        sx={{
          position: "absolute",
          top: -6,
          right: -6,
          width: 18,
          height: 18,
          borderRadius: "50%",
          bgcolor: hasAudio ? "#B43D20" : "rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }}
      >
        {playingHere ? (
          <GraphicEqRoundedIcon sx={{ fontSize: "0.7rem", color: "#fff" }} />
        ) : (
          <VolumeUpRoundedIcon sx={{ fontSize: "0.7rem", color: hasAudio ? "#fff" : "rgba(0,0,0,0.4)" }} />
        )}
      </Box>
    );
  };

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

      {/* Prompt image — fixed height, auto width, so the whole picture shows
          rather than a square crop. The height matches the other exercise
          image boxes (MatchAudioExercisePlaceholder, MatchDotsMedia) so every
          exercise's imagery reads at the same scale even though the images
          themselves are not all the same shape. */}
      <Box
        sx={{
          height: { xs: 148, sm: 180 },
          width: shouldShowImage ? "auto" : { xs: 148, sm: 180 },
          maxWidth: "100%",
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
            sx={{ height: "100%", width: "auto", maxWidth: "100%", objectFit: "contain", display: "block" }}
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
          if (!canEdit) return;
          e.preventDefault();
          setBoxDragOver(true);
        }}
        onDragLeave={() => setBoxDragOver(false)}
        onDrop={canEdit ? onDropBox : undefined}
        sx={{
          width: "100%",
          minHeight: 64,
          borderRadius: "14px",
          border: `2px ${placed.length ? "solid" : "dashed"} ${
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
          justifyContent: placed.length ? "flex-start" : "center",
          gap: 1,
          px: 2,
          py: 1.5,
          transition: "border-color 0.2s, background-color 0.2s",
          boxShadow: boxDragOver ? "0 0 0 4px rgba(96,165,250,0.2)" : "none",
        }}
      >
        {placed.length === 0 ? (
          <Typography sx={{ color: "text.disabled", fontSize: "0.9rem", userSelect: "none" }}>
            Drop the words here in order…
          </Typography>
        ) : (
          placed.map((placement, pos) => {
            // Graded per tile, not by whether the whole box is right — a
            // learner with three of five correct sees which three, rather
            // than one pass/fail colour across every tile.
            const tileCorrect = checked && isTileCorrect(placedTiles, correctSequence, pos);
            const tileWrong = checked && !tileCorrect;
            const key = `box:${placement.id}`;
            const tone = checked ? (tileCorrect ? "correct" : "wrong") : "idle";

            return (
              <Box
                key={placement.id}
                draggable={canEdit}
                onDragStart={canEdit ? (e) => onDragStart(e, { source: "box", id: placement.id }) : undefined}
                onClick={() => {
                  if (canEdit) removeTile(placement.id);
                  else if (tilesPlayAudio) playTileAudio(key, placement.value);
                }}
                onDragOver={
                  canEdit
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setBoxDragOver(true);
                      }
                    : undefined
                }
                onDrop={canEdit ? (e) => onDropOnTile(e, pos) : undefined}
                title={
                  canEdit
                    ? "Drag out, drag onto another tile to reorder, or click to remove"
                    : tilesPlayAudio
                      ? "Click to hear this"
                      : undefined
                }
                sx={tileSx(tone, canEdit || tilesPlayAudio)}
              >
                {placement.value}
                {tilesPlayAudio && <AudioCorner value={placement.value} playingHere={playingKey === key} />}
              </Box>
            );
          })
        )}
      </Box>

      {/* Bank — every distinct tile on offer. A tile stays here after being
          placed (it is not consumed), since the same tile can be dropped in
          more than once when the answer repeats a character. */}
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
        onDragOver={
          canEdit
            ? (e) => {
                e.preventDefault();
                setBankDragOver(true);
              }
            : undefined
        }
        onDragLeave={() => setBankDragOver(false)}
        onDrop={canEdit ? onDropBank : undefined}
      >
        {options.map((value) => {
          const key = `bank:${value}`;
          return (
            <Box
              key={value}
              draggable={canEdit}
              onDragStart={canEdit ? (e) => onDragStart(e, { source: "bank", value }) : undefined}
              onClick={() => {
                if (canEdit) addTile(value);
                else if (tilesPlayAudio) playTileAudio(key, value);
              }}
              title={
                canEdit
                  ? "Drag to the box above, or click to add"
                  : tilesPlayAudio
                    ? "Click to hear this"
                    : undefined
              }
              sx={{
                position: "relative",
                px: 2.5,
                py: 1.25,
                border: "2px solid rgba(0,0,0,0.1)",
                borderRadius: "12px",
                cursor: canEdit || tilesPlayAudio ? "pointer" : "default",
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
                "&:hover": canEdit
                  ? {
                      transform: "translateY(-2px)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      borderColor: "#B43D20",
                    }
                  : {},
              }}
            >
              {value}
              {tilesPlayAudio && <AudioCorner value={value} playingHere={playingKey === key} />}
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
        <Box
          component="button"
          onClick={handleCheck}
          sx={{
            px: 3,
            py: 1.25,
            borderRadius: 999,
            border: "none",
            bgcolor: "#B43D20",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: "0 4px 14px rgba(180,61,32,0.35)",
            "&:hover": { bgcolor: "#9D351C" },
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
