"use client";

import React from "react";
import { Box } from "@mui/material";

import { mediaSrc, resolveMedia } from "../../lib/content/media";
import type { Media } from "../../payload/payload-types";

/*
 * A video file from the `media` collection.
 *
 * Renders nothing when the relationship is unset or unpopulated; see
 * `MediaImage` for why that is the right failure.
 */
export const MediaVideo: React.FC<{
  value: Media | number | null | undefined;
  className?: string;
}> = ({ value, className }) => {
  const src = mediaSrc(value);
  if (!src) return null;

  return (
    <Box
      component="video"
      className={className}
      controls
      preload="metadata"
      src={src}
      // The intrinsic size, when the file has one, so the player is not laid out
      // at a default 300×150 and then resized once metadata arrives.
      width={resolveMedia(value)?.width ?? undefined}
      height={resolveMedia(value)?.height ?? undefined}
      sx={{ width: "100%", height: "auto", borderRadius: "12px", display: "block" }}
    />
  );
};

export default MediaVideo;
