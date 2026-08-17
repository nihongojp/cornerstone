"use client";

import React, { useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";

import { renderableTerm, type TermDisplay, type TermLike } from "../../lib/content/furigana";
import { mediaSrc } from "../../lib/content/media";
import type { Term } from "../../payload/payload-types";

import Ruby from "./Ruby";

/*
 * A word from the vocabulary catalogue, inline in a sentence.
 *
 * This is the first thing in the product that actually consumes `terms`. The
 * point of the collection was that a word is authored once and its reading,
 * furigana, gloss and audio follow it everywhere — this is "everywhere". Fixing a
 * term's reading fixes every sentence referencing it, rather than the one copy
 * the author happened to be editing, which is what `utils/termMedia.ts` spent
 * ~330 lines of fuzzy string matching trying to approximate.
 *
 * What to show is decided by `renderableTerm`, which is tested — every failure
 * here is silent (a gap mid-sentence, an empty `<rt>`, a play button attached to
 * nothing), so none of that logic lives in this file.
 */
export const TermRef: React.FC<{
  term: Term | number | null | undefined;
  display: TermDisplay;
  showAudio?: boolean | null;
}> = ({ term, display, showAudio }) => {
  const rendered = renderableTerm(term as TermLike | number | null | undefined, display);
  // Null means the relationship is unset or came back as a bare id because the
  // read was too shallow. Rendering the id would be worse than rendering nothing;
  // `npm run content:verify` is what makes the second case a failure.
  if (!rendered) return null;

  const audioSrc =
    showAudio && typeof term === "object" && term !== null ? mediaSrc(term.audio) : undefined;

  return (
    <Box component="span" sx={{ whiteSpace: "nowrap" }}>
      {rendered.kind === "ruby" ? <Ruby segments={rendered.segments} /> : rendered.text}
      {audioSrc && <PlayTerm src={audioSrc} />}
    </Box>
  );
};

/**
 * A play button sized to sit in a line of text.
 *
 * Same shape as the audio buttons in the exercise components — an `<audio>`
 * element with a ref rather than `new Audio()`, so the browser's own preload and
 * cookie handling apply. The cookie matters: the file is behind the auth-gated
 * media route.
 */
const PlayTerm: React.FC<{ src: string }> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setPlaying(true);
    audioRef.current.play().catch(() => setPlaying(false));
  };

  return (
    <>
      <audio ref={audioRef} src={src} preload="none" onEnded={() => setPlaying(false)} />
      <IconButton
        size="small"
        onClick={play}
        aria-label="Play pronunciation"
        sx={{ ml: 0.25, p: 0.25, verticalAlign: "baseline", color: playing ? "#B43D20" : "inherit" }}
      >
        <VolumeUpRoundedIcon sx={{ fontSize: "0.95em" }} />
      </IconButton>
    </>
  );
};

export default TermRef;
