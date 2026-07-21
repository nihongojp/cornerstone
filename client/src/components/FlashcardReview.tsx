import React, { useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

export type FlashcardReviewTerm = {
  term: string;
  audioUrl?: string;
  videoUrl?: string;
  imageUrl?: string;
};

interface Props {
  terms: FlashcardReviewTerm[];
}

const BRAND = "#B43D20";

function isPlaceholder(url?: string) {
  return !url || url.toUpperCase().includes("PLACEHOLDER");
}

const SingleCard: React.FC<{ term: FlashcardReviewTerm }> = ({ term }) => {
  const [flipped, setFlipped] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = !isPlaceholder(term.audioUrl);
  const hasVideo = !isPlaceholder(term.videoUrl);

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasAudio || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    setPlaying(true);
    audioRef.current.play().catch(() => setPlaying(false));
  };

  return (
    <Box
      onClick={() => setFlipped((f) => !f)}
      sx={{
        perspective: "1000px",
        width: { xs: "100%", sm: 220 },
        maxWidth: 260,
        height: 180,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── Front face: video placeholder ─────────────────────────────── */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            borderRadius: "18px",
            border: "2px solid rgba(0,0,0,0.08)",
            bgcolor: "#F3F4F6",
            boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.12)" },
            transition: "box-shadow 0.2s",
          }}
        >
          {/* Embedded video, or a pulsing placeholder until one is provided */}
          {hasVideo ? (
            <Box
              sx={{
                width: "80%",
                aspectRatio: "16/9",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <video
                src={term.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                width: "80%",
                aspectRatio: "16/9",
                borderRadius: "10px",
                bgcolor: "rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
                  animation: "shimmer 1.8s ease-in-out infinite",
                },
                "@keyframes shimmer": {
                  "0%": { transform: "translateX(-100%)" },
                  "100%": { transform: "translateX(100%)" },
                },
              }}
            >
              {/* Play triangle */}
              <Box
                sx={{
                  width: 0,
                  height: 0,
                  borderTop: "8px solid transparent",
                  borderBottom: "8px solid transparent",
                  borderLeft: "14px solid rgba(0,0,0,0.22)",
                  ml: "3px",
                  zIndex: 1,
                }}
              />
            </Box>
          )}

          <Typography
            sx={{
              fontSize: "0.65rem",
              fontWeight: 700,
              color: "text.disabled",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Tap to flip
          </Typography>
        </Box>

        {/* ── Back face: audio button + term ────────────────────────────── */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: "18px",
            border: "2px solid rgba(0,0,0,0.1)",
            bgcolor: "#FFFFFF",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
            px: 1.5,
          }}
        >
          {hasAudio && (
            <audio
              ref={audioRef}
              src={term.audioUrl}
              preload="auto"
              onEnded={() => setPlaying(false)}
            />
          )}

          {/* Audio button */}
          <Box
            onClick={playAudio}
            sx={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              bgcolor: hasAudio ? BRAND : "rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: hasAudio ? "pointer" : "default",
              boxShadow: hasAudio ? "0 4px 14px rgba(180,61,32,0.35)" : "none",
              animation: playing ? "audioPulse 1.2s ease-in-out infinite" : "none",
              "@keyframes audioPulse": {
                "0%,100%": { boxShadow: "0 0 0 0 rgba(180,61,32,0.4)" },
                "50%": { boxShadow: "0 0 0 12px rgba(180,61,32,0)" },
              },
              transition: "box-shadow 0.3s",
              flexShrink: 0,
            }}
          >
            {playing
              ? <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: "1.4rem" }} />
              : <VolumeUpRoundedIcon sx={{ color: hasAudio ? "#fff" : "rgba(0,0,0,0.25)", fontSize: "1.4rem" }} />}
          </Box>

          {/* Term text */}
          <Typography
            sx={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#1C1917",
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            {term.term}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const FlashcardReview: React.FC<Props> = ({ terms }) => (
  <Box
    sx={{
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      px: { xs: 1, sm: 2 },
      minHeight: "100%",
    }}
  >
    <Typography
      variant="body2"
      sx={{ color: "text.secondary", fontWeight: 600, textAlign: "center" }}
    >
      Review the situations with their corresponding phrases
    </Typography>

    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: { xs: 2, sm: 2.5 },
        justifyContent: "center",
      }}
    >
      {terms.map((term, i) => (
        <SingleCard key={i} term={term} />
      ))}
    </Box>
  </Box>
);

export default FlashcardReview;
