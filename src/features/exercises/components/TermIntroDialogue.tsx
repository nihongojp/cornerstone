"use client";

import React, { useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

import MediaImage from "@/components/media/MediaImage";
import MediaVideo from "@/components/media/MediaVideo";
import { mediaSrc, renderableImage } from "@/lib/content/media";
import { proseToPlainText } from "@/lib/content/prose";
import type {
  DialogueBlock,
  Media,
  MediaFigureBlock,
  VideoLessonBlock,
} from "@/payload/payload-types";

import { DialogueTranscript, type BlockOf } from "./RenderBlock";

const BRAND = "#B43D20";

/*
 * Same round audio-button pattern as CharacterSpotlight / TermCard, sized down
 * (~38px) so it sits beside the term row instead of dominating it.
 */
const TermAudioButton: React.FC<{ audioUrl: string }> = ({ audioUrl }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setPlaying(true);
    audioRef.current.play().catch(() => setPlaying(false));
  };

  return (
    <>
      <audio ref={audioRef} src={audioUrl} preload="auto" onEnded={() => setPlaying(false)} />
      <Box
        onClick={playAudio}
        role="button"
        aria-label="Play pronunciation"
        sx={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          bgcolor: BRAND,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 3px 10px rgba(180,61,32,0.35)",
          animation: playing ? "termIntroPulse 1.2s ease-in-out infinite" : "none",
          "@keyframes termIntroPulse": {
            "0%,100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.4)" },
            "50%": { boxShadow: "0 0 0 10px rgba(180,61,32,0)" },
          },
          transition: "box-shadow 0.3s",
          flexShrink: 0,
        }}
      >
        {playing ? (
          <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: "1.15rem" }} />
        ) : (
          <VolumeUpRoundedIcon sx={{ color: "#fff", fontSize: "1.15rem" }} />
        )}
      </Box>
    </>
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

export type TermIntroDialogueProps = {
  term: string;
  /** Plain-text detail shown after an em dash when present. */
  note?: string;
  audioUrl?: string;
  video?: Media | number | null;
  image?: Media | number | null;
  dialogue: DialogueBlock;
};

/*
 * Term introduction with a dialogue transcript: term (+ optional note) and
 * audio at the top, media (or a gray placeholder) in the middle, compact
 * dialogue card underneath. Composed by `RenderExercise` when a screen's
 * blocks are only dialogue / videoLesson / mediaFigure and a term name
 * resolves.
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
        gap: { xs: 1.25, sm: 1.5 },
        // Prefer fitting the lesson viewport; media shrinks before dialogue.
        minHeight: 0,
        height: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.25,
          flexShrink: 0,
          textAlign: "center",
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontWeight: 800,
            fontSize: { xs: "1.25rem", sm: "1.4rem" },
            color: "#1C1917",
            lineHeight: 1.25,
          }}
        >
          {detail ? (
            <>
              {term}
              <Box component="span" sx={{ fontWeight: 600, color: "#57534E" }}>
                {" "}
                — {detail}
              </Box>
            </>
          ) : (
            term
          )}
        </Typography>
        {audioUrl ? <TermAudioButton audioUrl={audioUrl} /> : null}
      </Box>

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
                <Box
                  sx={{
                    width: "100%",
                    maxHeight: { xs: 200, sm: 240 },
                    "& video": { maxHeight: { xs: 200, sm: 240 }, objectFit: "contain" },
                  }}
                >
                  <MediaVideo value={media.value} />
                </Box>
              );
            case "image":
              return (
                <Box
                  sx={{
                    width: "100%",
                    maxHeight: { xs: 200, sm: 240 },
                    display: "flex",
                    justifyContent: "center",
                    "& img": { maxHeight: { xs: 200, sm: 240 }, objectFit: "contain" },
                  }}
                >
                  <MediaImage value={media.value} size="wide" />
                </Box>
              );
            case "placeholder":
              return (
                <Box
                  aria-hidden
                  sx={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    maxHeight: { xs: 180, sm: 220 },
                    borderRadius: "12px",
                    bgcolor: "rgba(0,0,0,0.08)",
                  }}
                />
              );
            default: {
              const _exhaustive: never = media;
              return _exhaustive;
            }
          }
        })()}
      </Box>

      <Box sx={{ flexShrink: 0, width: "100%" }}>
        <DialogueTranscript
          speakerA={dialogue.speakerA}
          speakerB={dialogue.speakerB}
          lines={dialogue.lines}
          compact
        />
      </Box>
    </Box>
  );
};

export default TermIntroDialogue;

/** Block types that can participate in a term-intro composite screen. */
const TERM_INTRO_BLOCK_TYPES = new Set(["dialogue", "videoLesson", "mediaFigure"]);

/**
 * When every block on the screen is dialogue / videoLesson / mediaFigure and a
 * term name can be resolved, return the props for `TermIntroDialogue`.
 * Otherwise null — `RenderExercise` falls back to stacking blocks.
 *
 * Content patterns (from the snapshot):
 * - dialogue + videoLesson → term/note/audio/video from videoLesson
 * - dialogue + mediaFigure → term from dialogue.title; audio/media from mediaFigure
 * - dialogue only (titled) → term from dialogue.title; placeholder media
 */
export function resolveTermIntro(blocks: BlockOf[]): TermIntroDialogueProps | null {
  if (blocks.length === 0) return null;
  if (!blocks.every((b) => TERM_INTRO_BLOCK_TYPES.has(b.blockType))) return null;

  const dialogue = blocks.find((b): b is DialogueBlock & BlockOf => b.blockType === "dialogue");
  if (!dialogue) return null;

  const videoLesson = blocks.find(
    (b): b is VideoLessonBlock & BlockOf => b.blockType === "videoLesson"
  );
  const mediaFigure = blocks.find(
    (b): b is MediaFigureBlock & BlockOf => b.blockType === "mediaFigure"
  );

  if (videoLesson) {
    const title = videoLesson.title?.trim();
    if (!title) return null;
    const note = proseToPlainText(videoLesson.content).trim();
    return {
      term: title,
      note: note || undefined,
      audioUrl: mediaSrc(videoLesson.audio),
      video: videoLesson.video ?? dialogue.video ?? null,
      image: mediaFigure?.image ?? null,
      dialogue,
    };
  }

  const title = dialogue.title?.trim();
  if (!title) return null;

  return {
    term: title,
    audioUrl: mediaSrc(mediaFigure?.audio),
    video: mediaFigure?.video ?? dialogue.video ?? null,
    image: mediaFigure?.image ?? null,
    dialogue,
  };
}
