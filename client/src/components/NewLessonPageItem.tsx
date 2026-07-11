import React from "react";
import { Box, Typography, Chip } from "@mui/material";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";

const BRAND = "#B43D20";

interface Props {
  item: any;
}

const NewLessonPageItem: React.FC<Props> = ({ item }) => {
  const title: string = item.title || "";

  // ── Video dialogue (pages 1–7) ───────────────────────────────────────────
  if (Array.isArray(item.videoForm)) {
    return (
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
        {/* Video placeholder */}
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

        {/* Title */}
        <Typography
          sx={{ fontWeight: 900, fontSize: "1.1rem", color: "#1C1917", mb: 2, letterSpacing: "-0.01em" }}
        >
          {title}
        </Typography>

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

  // ── Flashcard review with terms (pages 13–15) ─────────────────────────────
  if (Array.isArray(item.terms)) {
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

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1.5 }}>
          {(item.terms as any[]).map((t, i) => (
            <Box
              key={i}
              sx={{
                px: 2,
                py: 2.5,
                borderRadius: "16px",
                border: "1px solid rgba(0,0,0,0.09)",
                bgcolor: "#fff",
                boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                textAlign: "center",
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#1C1917", mb: 1 }}>
                {t.term}
              </Typography>
              <Chip
                label="Image soon"
                size="small"
                sx={{ fontSize: "0.65rem", height: 18, opacity: 0.5 }}
              />
            </Box>
          ))}
        </Box>
      </Box>
    );
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
