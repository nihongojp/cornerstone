"use client";

import React, { useState } from "react";
import { Box } from "@mui/material";

import { mediaSrc } from "../../lib/content/media";
import type { Media } from "../../payload/payload-types";
import AudioButton from "./AudioButton";
import AudioSpeedControl, { type AudioSpeed } from "./AudioSpeedControl";

/*
 * An audio file from the `media` collection, as the app's small round play
 * button. It used to be the browser's own player bar, which sat next to the
 * round buttons everywhere else and made audio look different from screen to
 * screen.
 *
 * `speed` follows a control the caller owns (one speed for a whole screen);
 * `withSpeed` gives this clip its own speed pills instead.
 *
 * Renders nothing when the relationship is unset or unpopulated; see
 * `MediaImage` for why that is the right failure.
 */
export const MediaAudio: React.FC<{
  value: Media | number | null | undefined;
  className?: string;
  speed?: number;
  withSpeed?: boolean;
}> = ({ value, className, speed, withSpeed }) => {
  const [ownSpeed, setOwnSpeed] = useState<AudioSpeed>(1);
  const src = mediaSrc(value);
  if (!src) return null;

  return (
    <Box
      className={className}
      sx={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}
    >
      <AudioButton src={src} speed={withSpeed ? ownSpeed : (speed ?? 1)} />
      {withSpeed && <AudioSpeedControl speed={ownSpeed} onChange={setOwnSpeed} />}
    </Box>
  );
};

export default MediaAudio;
