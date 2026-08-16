"use client";

import React, { useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import FlashcardReview from "./FlashcardReview";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";

const BRAND = "#B43D20";

interface Props {
  item: any;
}

// New terms may arrive as plain strings or as objects with optional metadata.
type NewTerm = { term: string; definition?: string; audioUrl?: string; videoUrl?: string };

function isPlaceholderUrl(url?: string) {
  return !url || url.toUpperCase().includes("PLACEHOLDER");
}

// Normalise the loose `newTerms` field into a consistent shape. Accepts the
// common alias keys used across the newlessons data so pages don't have to be
// hand-migrated to a single spelling.
function normaliseNewTerms(raw: any): NewTerm[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t): NewTerm | null => {
      if (typeof t === "string") return { term: t };
      if (t && typeof t === "object") {
        const term = t.term ?? t.word ?? t.text ?? t.Title ?? t.title ?? "";
        if (!term) return null;
        return {
          term: String(term),
          definition: t.definition ?? t.meaning ?? t.translation,
          audioUrl: t.audioUrl ?? t.audio,
          videoUrl: t.videoUrl ?? t.video,
        };
      }
      return null;
    })
    .filter((t): t is NewTerm => t !== null);
}

// A small embedded video for a new term. Falls back to a static "coming
// soon" placeholder when no real videoUrl has been provided yet.
const NewTermVideo: React.FC<{ videoUrl?: string }> = ({ videoUrl }) => {
  const hasVideo = !isPlaceholderUrl(videoUrl);

  return (
    <Box
      sx={{
        width: 64,
        height: 36,
        flexShrink: 0,
        borderRadius: "8px",
        bgcolor: "rgba(0,0,0,0.08)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {hasVideo ? (
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Box
          sx={{
            width: 0,
            height: 0,
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderLeft: "9px solid rgba(0,0,0,0.25)",
            ml: "2px",
          }}
        />
      )}
    </Box>
  );
};

// A clickable pronunciation button, mirroring FlashcardReview's native-<audio>
// playback pattern (VolumeUp → GraphicEq while playing). Reused for both the
// per-term rows below and the single term introduced by a page's title.
const TermAudioButton: React.FC<{ audioUrl?: string; label: string; size?: number }> = ({
  audioUrl,
  label,
  size = 40,
}) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = !isPlaceholderUrl(audioUrl);

  const playAudio = () => {
    if (!hasAudio || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    setPlaying(true);
    audioRef.current.play().catch(() => setPlaying(false));
  };

  return (
    <>
      {hasAudio && (
        <audio ref={audioRef} src={audioUrl} preload="auto" onEnded={() => setPlaying(false)} />
      )}
      <Box
        onClick={playAudio}
        role="button"
        aria-label={`Play pronunciation of ${label}`}
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: "50%",
          bgcolor: hasAudio ? BRAND : "rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: hasAudio ? "pointer" : "default",
          boxShadow: hasAudio ? "0 3px 10px rgba(180,61,32,0.3)" : "none",
          animation: playing ? "audioPulse 1.2s ease-in-out infinite" : "none",
          "@keyframes audioPulse": {
            "0%,100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.4)" },
            "50%": { boxShadow: "0 0 0 10px rgba(180,61,32,0)" },
          },
          transition: "box-shadow 0.3s",
        }}
      >
        {playing
          ? <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: size * 0.3 }} />
          : <VolumeUpRoundedIcon sx={{ color: hasAudio ? "#fff" : "rgba(0,0,0,0.25)", fontSize: size * 0.3 }} />}
      </Box>
    </>
  );
};

// A single new-term row with a video placeholder and an audio button.
const NewTermRow: React.FC<{ term: NewTerm }> = ({ term }) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: "12px",
        border: "1px solid rgba(180,61,32,0.15)",
        bgcolor: "rgba(180,61,32,0.03)",
      }}
    >
      {/* Video placeholder / embed */}
      <NewTermVideo videoUrl={term.videoUrl} />

      <TermAudioButton audioUrl={term.audioUrl} label={term.term} />

      {/* Term + optional definition */}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#1C1917", lineHeight: 1.3 }}>
          {term.term}
        </Typography>
        {term.definition && (
          <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", lineHeight: 1.4 }}>
            {term.definition}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// Renders the "New terms" section shown beneath a page's video + transcript.
// Returns null when the page introduces no new terms, so existing pages are
// unaffected.
const NewTermsSection: React.FC<{ terms: NewTerm[] }> = ({ terms }) => {
  if (!terms.length) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: "9px", bgcolor: BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <StyleRoundedIcon sx={{ color: "#fff", fontSize: "0.95rem" }} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
          New terms
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {terms.map((t, i) => (
          <NewTermRow key={i} term={t} />
        ))}
      </Box>
    </Box>
  );
};

// The main dialogue video for a videoForm page. Adds a replay overlay once
// the clip finishes, since the native `controls` replay affordance is easy
// to miss.
const DialogueVideo: React.FC<{ videoUrl: string }> = ({ videoUrl }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ended, setEnded] = useState(false);

  const replay = () => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    setEnded(false);
    el.play().catch(() => {});
  };

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        borderRadius: "16px",
        overflow: "hidden",
        mb: 3,
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        onEnded={() => setEnded(true)}
        onPlay={() => setEnded(false)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {ended && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0,0,0,0.35)",
            pointerEvents: "none",
          }}
        >
          <IconButton
            onClick={replay}
            aria-label="Replay video"
            sx={{
              pointerEvents: "auto",
              width: 56,
              height: 56,
              bgcolor: "rgba(255,255,255,0.92)",
              "&:hover": { bgcolor: "#fff" },
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <ReplayRoundedIcon sx={{ fontSize: "1.8rem", color: BRAND }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

const NewLessonPageItem: React.FC<Props> = ({ item }) => {
  const title: string = item.title || "";

  // ── Video dialogue (pages 1–7) ───────────────────────────────────────────
  if (Array.isArray(item.videoForm)) {
    const videoUrl = (item.videoUrl ?? item.videoURL ?? item.video) as string | undefined;
    const hasVideo = !isPlaceholderUrl(videoUrl);

    return (
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
        {/* Video placeholder / embed */}
        {hasVideo ? (
          <DialogueVideo videoUrl={videoUrl as string} />
        ) : (
          <Box
            sx={{
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: "16px",
              bgcolor: "rgba(0,0,0,0.06)",
              border: "2px dashed rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              mb: 3,
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                bgcolor: "rgba(0,0,0,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 0,
                  height: 0,
                  borderTop: "10px solid transparent",
                  borderBottom: "10px solid transparent",
                  borderLeft: "18px solid rgba(0,0,0,0.3)",
                  ml: "4px",
                }}
              />
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: "text.disabled", fontWeight: 600 }}>
              Video coming soon
            </Typography>
          </Box>
        )}

        {/* Title + pronunciation button for the term this page introduces,
            with its optional description shown inline in smaller text. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Typography
            sx={{ fontWeight: 900, fontSize: "1.1rem", color: "#1C1917", letterSpacing: "-0.01em" }}
          >
            {title}
          </Typography>
          <TermAudioButton audioUrl={item.audioUrl ?? item.audioURL ?? item.audio} label={title} size={32} />
          {item.description && (
            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", lineHeight: 1.4 }}>
              — {item.description}
            </Typography>
          )}
        </Box>

        {/* Transcript */}
        <Box
          sx={{
            borderRadius: "14px",
            border: "1px solid rgba(0,0,0,0.08)",
            bgcolor: "#fff",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: "rgba(0,0,0,0.03)",
              borderBottom: "1px solid rgba(0,0,0,0.07)",
            }}
          />

          <Box sx={{ px: 2.5, py: 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
            {(item.videoForm as string[]).map((line, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    color: i % 2 === 0 ? BRAND : "#6366f1",
                    whiteSpace: "nowrap",
                    mt: "2px",
                    minWidth: 80,
                  }}
                >
                  {i % 2 === 0 ? "Person A:" : "Person B:"}
                </Typography>
                <Typography sx={{ fontSize: "0.92rem", color: "#1C1917", lineHeight: 1.5 }}>
                  {line}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* New terms — audio button alongside the video + transcript above */}
        <NewTermsSection terms={normaliseNewTerms(item.newTerms)} />
      </Box>
    );
  }

  // ── Grammar points (page 10, 11, 12) ───────────────────────────────────────
  if (Array.isArray(item.grammarPoints)) {
    return (
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: "10px", bgcolor: BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MenuBookRoundedIcon sx={{ color: "#fff", fontSize: "1.1rem" }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.01em" }}>
            {title}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {(item.grammarPoints as any[]).map((gp, i) => (
            <Box
              key={i}
              sx={{
                px: 2.5,
                py: 2,
                borderRadius: "14px",
                border: "1px solid rgba(180,61,32,0.15)",
                bgcolor: "rgba(180,61,32,0.03)",
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", color: BRAND, mb: 0.75 }}>
                {gp.pattern}
              </Typography>
              {(gp.examples || []).map((ex: string, j: number) => (
                <Typography key={j} variant="body2" sx={{ color: "text.secondary", pl: 1 }}>
                  → {ex}
                </Typography>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // ── Phrase flashcards (pages 8–9) ────────────────────────────────────────
  if (Array.isArray(item.phrases)) {
    return (
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: "10px", bgcolor: BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <StyleRoundedIcon sx={{ color: "#fff", fontSize: "1.1rem" }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.01em" }}>
            {title}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, justifyContent: "center" }}>
          {(item.phrases as string[]).map((phrase, i) => (
            <Box
              key={i}
              sx={{
                px: 3,
                py: 2,
                borderRadius: "16px",
                border: `2px solid rgba(180,61,32,0.2)`,
                bgcolor: "#fff",
                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                minWidth: 140,
                textAlign: "center",
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#1C1917" }}>
                {phrase}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // ── Flashcard review with terms ───────────────────────────────────────────
  if (Array.isArray(item.terms)) {
    return <FlashcardReview terms={item.terms as any[]} />;
  }

  // ── Generic page fallback (paragraph/content) ─────────────────────────────
  return (
    <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 }, textAlign: "center" }}>
      <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", mb: 1.5, color: "#1C1917" }}>
        {title}
      </Typography>
      {item.content ? (
        <Typography sx={{ color: "text.secondary", lineHeight: 1.7 }}>
          {String(item.content)}
        </Typography>
      ) : (
        <Typography sx={{ color: "text.disabled", fontStyle: "italic" }}>
          Content coming soon
        </Typography>
      )}
    </Box>
  );
};

export default NewLessonPageItem;
