"use client";
// src/pages/FunFacts.tsx
import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Stack,
} from "@mui/material";
import Bart from "../components/Menut";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

type Category =
  | "All"
  | "Places"
  | "Culture"
  | "History"
  | "Food"
  | "Urban legends"
  | "Random";

type Fact = {
  id: string;
  category: Exclude<Category, "All">;
  title: string;
  text: string;
  learnMoreHref?: string;
};

const FunFacts = (): React.ReactElement => {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");

  const facts: Fact[] = [
    {
      id: "places-1",
      category: "Places",
      title: "Places Fact #1",
      text: "Did you know that Japan has a rabbit island? It’s called Ookunoshima and it’s located near Hiroshima prefecture.",
    },
    {
      id: "places-2",
      category: "Places",
      title: "Places Fact #2",
      text: "Did you know that Tokyo is written as the “east capital” because it’s to the East of the previous capital, Kyoto.",
    },
    {
      id: "places-3",
      category: "Places",
      title: "Places Fact #3",
      text: "Did you know that Nagasaki has a lot of western influence? This was the only port city open to foreigners (the Dutch) during the isolation period.",
    },
    {
      id: "culture-1",
      category: "Culture",
      title: "Culture Fact #1",
      text: "Did you know that Dorodango means mud ball? It’s very shiny and fun to make!",
    },
    {
      id: "culture-2",
      category: "Culture",
      title: "Culture Fact #2",
      text: "Did you know most people celebrate Christmas by going to church, celebrate New Year’s Eve by going to a Buddhist temple, and celebrate New Year’s by going to a Shinto Shrine.",
    },
    {
      id: "history-1",
      category: "History",
      title: "History Fact #1",
      text: "Did you know that the world’s still-operating company is Japan’s? It’s a construction company called Kongo-gumi.",
    },
    {
      id: "food-1",
      category: "Food",
      title: "Food Fact #1",
      text: "Did you know ramen varies heavily by region in Japan, from miso-rich Hokkaido styles to tonkotsu in Kyushu.",
    },
    {
      id: "urban-1",
      category: "Urban legends",
      title: "Urban Legends Fact #1",
      text: "Did you know many Japanese towns have local yokai stories tied to specific bridges, shrines, and forests.",
    },
    {
      id: "random-1",
      category: "Random",
      title: "Random Fact #1",
      text: "Did you know some train stations play unique melodies to help commuters recognize stops more easily.",
    },
  ];

  const categories: Category[] = [
    "All",
    "Places",
    "Culture",
    "History",
    "Food",
    "Urban legends",
    "Random",
  ];

  const filteredFacts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return facts.filter((f) => {
      const categoryOk = activeCategory === "All" ? true : f.category === activeCategory;
      const searchOk =
        q.length === 0
          ? true
          : `${f.title} ${f.text} ${f.category}`.toLowerCase().includes(q);

      return categoryOk && searchOk;
    });
  }, [activeCategory, search]);

  const handleReset = () => {
    setActiveCategory("All");
    setSearch("");
  };

  // category chip colors (subtle but clear)
  const chipStyles = (cat: Category) => {
    const active = activeCategory === cat;
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

      {/* Fun fact of the day card */}
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
        {/* subtle highlight strip */}
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
          Fun Fact of the Day:
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontSize: "14px",
            lineHeight: 1.6,
            opacity: 0.95,
            textAlign: "left",
          }}
        >
          During Japan’s self-isolation period (sakoku), there was an island called Dejima
          (it’s still there and has been restored if you’d like to visit!) in Nagasaki prefecture
          that was open to Dutch trade. The Dutch were Japan’s only main trading partners because
          they weren’t focused on spreading Christianity (unlike other European visitors). So, the
          Nagasaki area has a lot of European influence! If you ever go there now, there are lots
          of churches and stained glass windows in public buildings as well.
        </Typography>

        <Typography
          component="a"
          href="#"
          sx={{
            display: "inline-block",
            mt: 1.5,
            color: "#dee2e4",
            textDecoration: "underline",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          Learn more
        </Typography>
      </Box>

      {/* Controls */}
      <Box
        sx={{
          width: "min(980px, 92vw)",
          mx: "auto",
          mt: 3,
        }}
      >
        {/* Search + reset */}
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
              Categories
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
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

        {/* Category chips */}
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: "1px solid rgba(0,0,0,0.22)",
          }}
        >
          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
            {categories.slice(1).map((cat) => (
              <Chip
                key={cat}
                label={cat}
                clickable
                onClick={() => setActiveCategory(cat)}
                sx={chipStyles(cat)}
              />
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Cards */}
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
        {filteredFacts.map((fact) => (
          <Box
            key={fact.id}
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
            }}
          >
            {/* top accent bar + category */}
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
              <Typography sx={{ fontWeight: 900, fontSize: "12px", color: "#b4441d" }}>
                {fact.category}
              </Typography>

              <Box
                sx={{
                  height: 8,
                  width: 42,
                  borderRadius: 999,
                  bgcolor: "rgba(180, 68, 29, 0.45)",
                }}
              />
            </Box>

            {/* content */}
            <Box
              sx={{
                px: 2.25,
                py: 2,
                minHeight: 170,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 1.5,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontWeight: 900,
                    mb: 0.8,
                    letterSpacing: "-0.01em",
                    color: "#111",
                  }}
                >
                  {fact.title}
                </Typography>

                <Typography
                  sx={{
                    fontSize: "13px",
                    lineHeight: 1.55,
                    color: "rgba(0,0,0,0.78)",
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {fact.text}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography
                  component="a"
                  href={fact.learnMoreHref ?? "#"}
                  sx={{
                    fontSize: "13px",
                    color: "#111",
                    textDecoration: "underline",
                    fontWeight: 800,
                  }}
                >
                  Learn more
                </Typography>

                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "rgba(180, 68, 29, 0.55)",
                  }}
                />
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default FunFacts;
