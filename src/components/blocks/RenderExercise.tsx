"use client";

import React from "react";
import { Box } from "@mui/material";

import RenderBlock, { type BlockOf, type ResultCallback } from "./RenderBlock";

/*
 * One exercise — one screen — as an ordered list of blocks.
 *
 * This is the thing `maxRows: 1` on `components` prevented, and the reason
 * removing it is what makes the CMS a CMS: a screen can now be a prose
 * introduction followed by the exercise it sets up, composed by an author,
 * without a developer adding a block for that combination.
 *
 * ── Grading a composite screen ──────────────────────────────────────────────
 *
 * `onResult` is handed to every block that takes it, and any one of them
 * reporting a result reports it for the screen. That is right while a screen
 * holds at most one graded block, which is what the library encourages —
 * Practice blocks are one per screen. A screen with two graded blocks would
 * record two attempts, which is arguably correct and definitely not something to
 * design for before anyone has authored it.
 */
export const RenderExercise: React.FC<{
  blocks: BlockOf[];
  onResult?: ResultCallback;
}> = ({ blocks, onResult }) => (
  <Box
    sx={{
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2.5,
    }}
  >
    {blocks.map((block, index) => (
      // The block row's Payload id is stable across edits — it is also what
      // Phase 4b keys learner progress on. Index is the fallback for a block
      // streamed by Live Preview before it has been saved and given one.
      <Box key={block.id ?? index} sx={{ width: "100%" }}>
        <RenderBlock block={block} onResult={onResult} />
      </Box>
    ))}
  </Box>
);

export default RenderExercise;
