"use client";

import React from "react";
import { Box } from "@mui/material";

import { mediaSrc } from "../../lib/content/media";
import type { Media } from "../../payload/payload-types";

/*
 * An audio file from the `media` collection, as the browser's own player.
 *
 * The bespoke play buttons in the exercise components stay as they are — they
 * are part of an exercise's interaction and several of them score on whether the
 * learner listened. This is for audio inside prose, where there is nothing to
 * score and the native control is the accessible default.
 *
 * Renders nothing when the relationship is unset or unpopulated; see
 * `MediaImage` for why that is the right failure.
 */
export const MediaAudio: React.FC<{
  value: Media | number | null | undefined;
  className?: string;
}> = ({ value, className }) => {
  const src = mediaSrc(value);
  if (!src) return null;

  return (
    <Box
      component="audio"
      className={className}
      controls
      preload="none"
      src={src}
      sx={{ width: "100%", maxWidth: 360, display: "block" }}
    />
  );
};

export default MediaAudio;
