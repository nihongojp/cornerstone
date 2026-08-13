"use client";

// src/pages/Watch.tsx
import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Stack,
  IconButton,
} from "@mui/material";
import Bart from "../components/Menut";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

type Level = "All" | "Beginner" | "Intermediate" | "Advanced";

type Video = {
  id: string;
  title: string;
  channel: string;
  minutes: number;
  level: Exclude<Level, "All">;
  topic: "Hiragana" | "Katakana" | "Grammar" | "Listening" | "Culture";
  url: string;
  description: string;
};

const Watch = (): React.ReactElement => {
  const [activeLevel, setActiveLevel] = useState<Level>("All");
  const [search, setSearch] = useState("");

  // Dummy/sample YT links (placeholders). Replace with your real curated list later.
  const videos: Video[] = [
    {
      id: "v1",
      title: "Hiragana in 10 Minutes (Quick Start)",
      channel: "Nihon-Go! Learning",
      minutes: 10,
      level: "Beginner",
      topic: "Hiragana",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      description: "Learn the basic hiragana set with simple mnemonics and clean pronunciation.",
    },
    {
      id: "v2",
      title: "Katakana Crash Course (Common Words)",
      channel: "Kana Lab",
      minutes: 14,
      level: "Beginner",
      topic: "Katakana",
      url: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
      description: "Fast recognition practice for katakana you’ll see in menus, brands, and signs.",
    },
    {
      id: "v3",
      title: "これ・それ・あれ Explained (With Examples)",
      channel: "Grammar Corner",
      minutes: 9,
      level: "Beginner",
      topic: "Grammar",
      url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      description: "The classic trio: when to use each, with real usage patterns you’ll remember.",
    },
    {
      id: "v4",
      title: "Listening Practice: Slow Japanese for Beginners",
      channel: "Slow Japanese Studio",
      minutes: 12,
      level: "Beginner",
      topic: "Listening",
      url: "https://www.youtube.com/watch?v=3GwjfUFyY6M",
      description: "Short dialogues with clear spacing so you can catch particles and intonation.",
    },
    {
      id: "v5",
      title: "Particles は vs が (The Practical Version)",
      channel: "JP Clarity",
      minutes: 18,
      level: "Intermediate",
      topic: "Grammar",
      url: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
      description: "Get a usable mental model of は/が with the situations that confuse everyone.",
    },
    {
      id: "v6",
      title: "Culture Bite: Convenience Store Etiquette",
      channel: "Nihon Life Bits",
      minutes: 7,
      level: "Beginner",
      topic: "Culture",
      url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
      description: "Tiny cultural details that make Japan feel instantly more navigable.",
    },
    {
      id: "v7",
      title: "Shadowing: Daily Phrases (Intermediate Speed)",
      channel: "Shadow Japan",
      minutes: 15,
      level: "Intermediate",
      topic: "Listening",
      url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
      description: "Repeat-after-me practice to improve rhythm, timing, and natural phrasing.",
    },
    {
      id: "v8",
      title: "Advanced: Keigo Basics (Polite Speech You Actually Need)",
      channel: "Workplace Japanese",
      minutes: 16,
      level: "Advanced",
      topic: "Grammar",
      url: "https://www.youtube.com/watch?v=2Vv-BfVoq4g",
      description: "Keigo without the overwhelm: a practical first pass for real-life situations.",
    },
  ];

  const levels: Level[] = ["All", "Beginner", "Intermediate", "Advanced"];

  const filteredVideos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return videos.filter((v) => {
      const levelOk = activeLevel === "All" ? true : v.level === activeLevel;
      const searchOk =
        q.length === 0
          ? true
          : `${v.title} ${v.channel} ${v.topic} ${v.level}`.toLowerCase().includes(q);
      return levelOk && searchOk;
    });
  }, [activeLevel, search]);

  const handleReset = () => {
    setActiveLevel("All");
    setSearch("");
  };

  const chipSx = (lvl: Level) => {
    const active = activeLevel === lvl;
    return {
      textTransform: "none",
      fontWeight: active ? 900 : 700,
      borderRadius: "999px",
      px: 1.25,
      py: 0.4,
      border: "1px solid",
      borderColor: active ? "rgba(180, 68, 29, 0.55)" : "rgba(0,0,0,0.14)",
      bgcolor: active ? "rgba(180, 68, 29, 0.10)" : "rgba(255,255,255,0.60)",
      color: "#111",
      "&:hover": {
        bgcolor: active ? "rgba(180, 68, 29, 0.14)" : "rgba(255,255,255,0.80)",
      },
    };
  };

  const topicPillSx = (topic: Video["topic"]) => ({
    fontSize: 12,
    fontWeight: 900,
    borderRadius: "999px",
    px: 1.1,
    py: 0.25,
    bgcolor: "rgba(180, 68, 29, 0.10)",
    border: "1px solid rgba(180, 68, 29, 0.22)",
    color: "#b4441d",
    width: "fit-content",
  });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        backgroundColor: "#dee2e4",
        backgroundSize: "22px 22px",
        paddingBottom: "70px",
        pt: "6px",
      }}
    >
      {/* Left menu */}
      <Box sx={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}>
        <Bart />
      </Box>

      {/* Hero card (match FunFacts vibe) */}
      <Box
        sx={{
          width: "min(980px, 92vw)",
          mx: "auto",
          mt: "70px",
          bgcolor: "#b4441d",
          color: "#dee2e4",
          borderRadius: "34px",
          px: { xs: 3, sm: 6 },
          py: { xs: 3, sm: 4 },
          boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: "120px",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.10), rgba(255,255,255,0.00))",
            pointerEvents: "none",
          }}
        />
        <Typography
          variant="h6"
          sx={{ fontWeight: 900, mb: 1, textAlign: "center", letterSpacing: "-0.02em" }}
        >
          Watch & Learn
        </Typography>
        <Typography sx={{ fontSize: 14, lineHeight: 1.6, opacity: 0.95 }}>
          Curated bite-size videos for hiragana, katakana, grammar, listening, and culture.
          Use the filters to match your level, then hit play.
        </Typography>
      </Box>

      {/* Controls */}
      <Box sx={{ width: "min(980px, 92vw)", mx: "auto", mt: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", sm: "row" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 2 }}>
            <Typography sx={{ fontWeight: 900, color: "#111" }}>All</Typography>
            <Box sx={{ width: "1px", height: "22px", bgcolor: "rgba(0,0,0,0.30)" }} />
            <Typography sx={{ fontWeight: 900, color: "#111", borderBottom: "2px solid #111" }}>
              Levels
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos"
              variant="standard"
              sx={{
                width: { xs: "100%", sm: "320px" },
                "& .MuiInput-underline:before": { borderBottomColor: "rgba(0,0,0,0.25)" },
                "& .MuiInput-underline:hover:before": { borderBottomColor: "rgba(0,0,0,0.55)" },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchRoundedIcon sx={{ color: "#b4441d" }} />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              onClick={handleReset}
              sx={{
                textTransform: "none",
                bgcolor: "#92a6ba",
                color: "#000",
                borderRadius: "999px",
                px: 3,
                py: 0.8,
                fontWeight: 900,
                boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                "&:hover": { bgcolor: "#7a92a8" },
              }}
            >
              Reset
            </Button>
          </Box>
        </Box>

        <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid rgba(0,0,0,0.22)" }}>
          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
            {levels.map((lvl) => (
              <Chip
                key={lvl}
                label={lvl}
                clickable
                onClick={() => setActiveLevel(lvl)}
                sx={chipSx(lvl)}
              />
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Video cards */}
      <Box
        sx={{
          width: "min(980px, 92vw)",
          mx: "auto",
          mt: 3,
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(3, minmax(0, 1fr))",
          },
          gap: "18px",
        }}
      >
        {filteredVideos.map((v) => (
          <Box
            key={v.id}
            sx={{
              borderRadius: "18px",
              overflow: "hidden",
              background: "rgba(255,255,255,0.65)",
              border: "1px solid rgba(0,0,0,0.10)",
              boxShadow: "0 10px 26px rgba(0,0,0,0.10)",
              transition: "transform 160ms ease, box-shadow 160ms ease",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: "0 14px 32px rgba(0,0,0,0.14)",
              },
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header strip */}
            <Box
              sx={{
                px: 2.25,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                bgcolor: "rgba(180, 68, 29, 0.08)",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <Typography sx={topicPillSx(v.topic)}>{v.topic}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.70)" }}>
                {v.minutes} min · {v.level}
              </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ px: 2.25, py: 2, display: "flex", flexDirection: "column", gap: 1.25, flex: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 900, color: "#111", letterSpacing: "-0.01em" }}>
                  {v.title}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: "rgba(0,0,0,0.65)", fontWeight: 800, mt: 0.25 }}>
                  {v.channel}
                </Typography>

                <Typography
                  sx={{
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "rgba(0,0,0,0.78)",
                    mt: 1,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {v.description}
                </Typography>
              </Box>

              {/* Actions */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: "auto" }}>
                <Button
                  component="a"
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<PlayArrowRoundedIcon />}
                  sx={{
                    textTransform: "none",
                    fontWeight: 900,
                    borderRadius: "999px",
                    px: 2.2,
                    bgcolor: "rgba(180, 68, 29, 0.10)",
                    color: "#111",
                    border: "1px solid rgba(180, 68, 29, 0.22)",
                    "&:hover": {
                      bgcolor: "rgba(180, 68, 29, 0.16)",
                    },
                  }}
                >
                  Watch
                </Button>

                <IconButton
                  component="a"
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open in new tab"
                  sx={{
                    borderRadius: 2,
                    border: "1px solid rgba(0,0,0,0.12)",
                    bgcolor: "rgba(255,255,255,0.55)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.75)" },
                  }}
                >
                  <OpenInNewRoundedIcon sx={{ color: "rgba(0,0,0,0.75)" }} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default Watch;
