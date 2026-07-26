import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Grid, IconButton, Typography, useMediaQuery, useTheme } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

type CardData = { id: number; front: string; back?: string; audio?: string };

type FlipsProps = {
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
  prompt?: string;
  cards?: CardData[];
};

const defaultCards: CardData[] = [
  { id: 0, front: "あ / ア" },
  { id: 1, front: "い / イ" },
  { id: 2, front: "う / ウ" },
];

// Cards like "あ / ア" show one character on each face of the flashcard.
function splitFaces(card: CardData): { frontFace: string; backFace: string } {
  const parts = card.front.split("/").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return { frontFace: parts[0], backFace: parts[1] };
  }
  return { frontFace: card.front, backFace: card.back || card.front };
}

const Flips: React.FC<FlipsProps> = ({
  onResult,
  prompt = "Flip each card to review.",
  cards = defaultCards,
}) => {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const completedRef = useRef(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const toggleFlip = (id: number) => {
    setFlipped((p) => ({ ...p, [id]: !p[id] }));
  };

  const playAudio = (src?: string) => {
    if (!src) return;
    new Audio(src).play().catch(() => {});
  };

  const allFlipped = useMemo(() => cards.every((c) => flipped[c.id]), [cards, flipped]);

  useEffect(() => {
    if (allFlipped && !completedRef.current) {
      completedRef.current = true;
      onResult?.({ result: "correct", detail: { allFlipped: true } });
    }
  }, [allFlipped, onResult]);

  if (!cards.length) return <Box p={3}><Typography>No cards to display.</Typography></Box>;

  return (
    <Box sx={{ width: "100%", maxWidth: 860, mx: "auto", px: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box sx={{ textAlign: "center", mb: 3 }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, color: "#1C1917" }}>
          {prompt}
        </Typography>

        {/* Mini progress pips */}
        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, mt: 1.5 }}>
          {cards.map((c) => (
            <Box
              key={c.id}
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: flipped[c.id] ? "#B43D20" : "rgba(0,0,0,0.12)",
                transition: "background-color 0.3s",
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Cards */}
      <Grid container spacing={{ xs: 2, sm: 2.5 }} justifyContent="center">
        {cards.map((card) => {
          const isFlipped = !!flipped[card.id];
          const { frontFace, backFace } = splitFaces(card);

          return (
            <Grid item key={card.id} xs={12} sm={6} md={4} display="flex" justifyContent="center">
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, width: "100%" }}>

                {/* Flip card */}
                <Box
                  onClick={() => toggleFlip(card.id)}
                  sx={{
                    perspective: "1000px",
                    width: isMobile ? "100%" : 220,
                    maxWidth: 260,
                    height: 180,
                    cursor: "pointer",
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
                      transformStyle: "preserve-3d",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                  >
                    {/* Front face */}
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        border: "2px solid rgba(0,0,0,0.1)",
                        borderRadius: "16px",
                        bgcolor: "#FFFFFF",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                        userSelect: "none",
                        transition: "box-shadow 0.2s",
                        "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.13)" },
                      }}
                    >
                      <Typography sx={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                        {frontFace}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.65rem" }}>
                        Hiragana
                      </Typography>
                    </Box>

                    {/* Back face */}
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        border: "2px solid rgba(0,0,0,0.1)",
                        borderRadius: "16px",
                        bgcolor: "#FFFFFF",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                        userSelect: "none",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <Typography sx={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                        {backFace}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.65rem" }}>
                        Katakana
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {card.audio && (
                  <IconButton size="small" onClick={() => playAudio(card.audio)} sx={{ color: "#B43D20" }}>
                    <VolumeUpIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default Flips;