import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";

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

  if (!cards.length) return <Box p={2}><Typography>No cards to display.</Typography></Box>;

  return (
    <Box sx={{ width: "100%", maxWidth: 860, mx: "auto", px: { xs: 0.5, sm: 1 } }}>
      <Box sx={{ textAlign: "center", mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, color: "#1C1917" }}>
          {prompt}
        </Typography>

        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, mt: 1 }}>
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

      {/* Keep cards in a compact wrapping row so 3–5 still fit without scrolling. */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: { xs: 1.25, sm: 2 },
        }}
      >
        {cards.map((card) => {
          const isFlipped = !!flipped[card.id];
          const { frontFace, backFace } = splitFaces(card);

          return (
            <Box
              key={card.id}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                width: { xs: 160, sm: 220 },
              }}
            >
              <Box
                onClick={() => toggleFlip(card.id)}
                sx={{
                  perspective: "1000px",
                  width: "100%",
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
                    }}
                  >
                    <Typography sx={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                      {frontFace}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontSize: "0.65rem",
                      }}
                    >
                      Hiragana
                    </Typography>
                  </Box>

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
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontSize: "0.65rem",
                      }}
                    >
                      Katakana
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {card.audio && (
                <IconButton
                  size="small"
                  onClick={() => playAudio(card.audio)}
                  aria-label="Play audio"
                  sx={{
                    width: 32,
                    height: 32,
                    color: "#fff",
                    bgcolor: "#B43D20",
                    boxShadow: "0 2px 10px rgba(180,61,32,0.3)",
                    "&:hover": { bgcolor: "#9D351C" },
                  }}
                >
                  <VolumeUpRoundedIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default Flips;
