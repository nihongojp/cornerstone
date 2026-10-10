"use client";

import React, { useState } from "react";
import { Box, Typography } from "@mui/material";

import AudioButton from "@/components/media/AudioButton";
import AudioSpeedControl, { type AudioSpeed } from "@/components/media/AudioSpeedControl";
import MediaImage from "@/components/media/MediaImage";
import MediaVideo from "@/components/media/MediaVideo";
import {
  DEFAULT_LESSON_VIDEO_ASPECT_RATIO,
  mediaAspectRatio,
  mediaSrc,
  renderableImage,
} from "@/lib/content/media";
import type { Media } from "@/payload/payload-types";

import type { TermIntroDialogueProps } from "../termIntro";
import { DialogueTranscript } from "./RenderBlock";

/** Max rendered height for the term-intro media stage (xs / sm). */
const MEDIA_MAX_HEIGHT_PX = { xs: 200, sm: 240 } as const;

function parseAspectRatio(ratio: string): { w: number; h: number } {
  const [wRaw, hRaw] = ratio.split("/").map((part) => Number(part.trim()));
  if (wRaw > 0 && hRaw > 0) return { w: wRaw, h: hRaw };
  return { w: 16, h: 9 };
}

/*
 * Shared stage for video, image, and the gray placeholder so they share one
 * aspect ratio and one max-height. Width is `min(100%, maxHeight × ratio)` so
 * capping height cannot squash the box into a flatter rectangle than the media.
 */
const TermIntroMediaStage: React.FC<{
  aspectRatio: string;
  children?: React.ReactNode;
  placeholder?: boolean;
}> = ({ aspectRatio, children, placeholder }) => {
  const { w, h } = parseAspectRatio(aspectRatio);

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 0,
      }}
    >
      <Box
        aria-hidden={placeholder ? true : undefined}
        sx={{
          aspectRatio,
          width: {
            xs: `min(100%, calc(${MEDIA_MAX_HEIGHT_PX.xs}px * ${w} / ${h}))`,
            sm: `min(100%, calc(${MEDIA_MAX_HEIGHT_PX.sm}px * ${w} / ${h}))`,
          },
          maxHeight: { xs: MEDIA_MAX_HEIGHT_PX.xs, sm: MEDIA_MAX_HEIGHT_PX.sm },
          borderRadius: "12px",
          overflow: "hidden",
          flexShrink: 1,
          ...(placeholder ? { bgcolor: "rgba(0,0,0,0.08)" } : null),
          "& video, & img": {
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            borderRadius: "12px",
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
type MediaSlot =
  | { kind: "video"; value: Media | number }
  | { kind: "image"; value: Media | number }
  | { kind: "placeholder" };

function resolveMediaSlot(
  video: Media | number | null | undefined,
  image: Media | number | null | undefined
): MediaSlot {
  if (video != null && mediaSrc(video)) return { kind: "video", value: video };
  if (image != null && renderableImage(image)) return { kind: "image", value: image };
  return { kind: "placeholder" };
}

/*
 * Term introduction with a dialogue transcript. Vertical order (confirmed):
 * media / placeholder → small term row (+ optional note + audio) → compact
 * dialogue card. Composed by `RenderExercise` when a screen's blocks are only
 * dialogue / videoLesson / mediaFigure and a term name resolves.
 */
const TermIntroDialogue: React.FC<TermIntroDialogueProps> = ({
  term,
  note,
  audioUrl,
  video,
  image,
  dialogue,
}) => {
  const detail = note?.trim() ?? "";
  const media = resolveMediaSlot(video, image);
  // One speed for the whole screen: the term's clip and every dialogue line.
  const [speed, setSpeed] = useState<AudioSpeed>(1);
  const hasAudio = Boolean(audioUrl) || (dialogue.lines ?? []).some((line) => Boolean(line.audio));
  // Prefer the Media document's own dimensions so player and placeholder match;
  // fall back to the lesson-video default when none are stored (current snapshot).
  const aspectRatio =
    mediaAspectRatio(video) ??
    mediaAspectRatio(image) ??
    DEFAULT_LESSON_VIDEO_ASPECT_RATIO;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 560,
        mx: "auto",
        px: { xs: 1, sm: 2 },
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: { xs: 0.75, sm: 1 },
        // `height: 100%` only resolves if an ancestor gives the screen a
        // definite height, and the runner's step wrapper sizes to content. So
        // today the media renders at its `MEDIA_MAX_HEIGHT_PX` cap and a taller
        // screen scrolls; the shrink below takes effect only once it has one.
        minHeight: 0,
        height: "100%",
      }}
    >
      <Box
        sx={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {(() => {
          switch (media.kind) {
            case "video":
              return (
                <TermIntroMediaStage
                  aspectRatio={mediaAspectRatio(media.value) ?? aspectRatio}
                >
                  <MediaVideo value={media.value} />
                </TermIntroMediaStage>
              );
            case "image":
              return (
                <TermIntroMediaStage
                  aspectRatio={mediaAspectRatio(media.value) ?? aspectRatio}
                >
                  <MediaImage value={media.value} size="wide" />
                </TermIntroMediaStage>
              );
            case "placeholder":
              return <TermIntroMediaStage aspectRatio={aspectRatio} placeholder />;
            default: {
              const _exhaustive: never = media;
              return _exhaustive;
            }
          }
        })()}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          flexWrap: "wrap",
          gap: 0.75,
          flexShrink: 0,
          textAlign: "left",
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontWeight: 700,
            fontSize: { xs: "1rem", sm: "1.05rem" },
            color: "#1C1917",
            lineHeight: 1.3,
          }}
        >
          {detail ? (
            <>
              {term}
              <Box component="span" sx={{ fontWeight: 500, color: "#57534E" }}>
                {" "}
                — {detail}
              </Box>
            </>
          ) : (
            term
          )}
        </Typography>
        {audioUrl ? <AudioButton src={audioUrl} speed={speed} /> : null}
        {hasAudio ? <AudioSpeedControl speed={speed} onChange={setSpeed} /> : null}
      </Box>

      <Box sx={{ flexShrink: 0, width: "100%" }}>
        <DialogueTranscript
          speakerA={dialogue.speakerA}
          speakerB={dialogue.speakerB}
          lines={dialogue.lines}
          audioSpeed={speed}
          compact
        />
      </Box>
    </Box>
  );
};

export default TermIntroDialogue;
