"use client";

// src/pages-client/Home.tsx
import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,

  Container,
  Stack,
  Grid,
  Chip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useSession } from "../lib/auth-client";

const MotionCard = motion(Card);
const EASE = [0.16, 1, 0.3, 1] as const;

const Home = (): React.ReactElement => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTabletDown = useMediaQuery(theme.breakpoints.down("md"));
  const router = useRouter();

  // Session-based (was a render-time localStorage read in the CRA app,
  // which is unsafe under SSR).
  const { data: session } = useSession();
  const isAuthed = Boolean(session);

  const go = (loggedInPath: string, publicPath: string) => {
    router.push(isAuthed ? loggedInPath : publicPath);
  };

  const sectionBox = (bgcolor: string, content: React.ReactNode, mt = 6) => (
    <Box
      sx={{
        bgcolor,
        mt,
        borderRadius: { xs: 3, sm: 4 },
        px: { xs: 2, sm: 3, md: 6 },
        py: { xs: 6, sm: 7, md: 8 },
        mx: { xs: 1.5, sm: 3, md: 6 },
      }}
    >
      <Container maxWidth="lg" sx={{ px: 0 }}>
        {content}
      </Container>
    </Box>
  );

  const featureCard = (title: string, desc: string) => (
    <MotionCard
      elevation={3}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: EASE }}
      whileHover={{ y: -4 }}
      sx={{ height: "100%", borderRadius: 3 }}
    >
      <CardContent sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="h6" fontWeight="bold" mb={1.5}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {desc}
        </Typography>
      </CardContent>
    </MotionCard>
  );

  return (
    <Box
      sx={{
        textAlign: "center",
        bgcolor: "#dfe2e5",
        mx: { xs: 0, sm: 2, md: 6 },
        my: { xs: 2, sm: 4, md: 5 },
        borderRadius: { xs: 0, sm: 4 },
      }}
    >
      {/* HERO */}
      <Box
        sx={{
          background:
            "linear-gradient(135deg, rgba(180,61,32,0.12) 0%, rgba(255,255,255,0.65) 40%, rgba(180,61,32,0.06) 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <Container maxWidth="lg">
          <Grid
            container
            spacing={6}
            alignItems="center"
            sx={{ pt: { xs: 6, sm: 8 }, pb: { xs: 6, sm: 8 } }}
          >
            {/* LEFT */}
            <Grid item xs={12} md={7}>
              <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                <Typography
                  variant={isMobile ? "h3" : isTabletDown ? "h2" : "h1"}
                  fontWeight={900}
                  sx={{ letterSpacing: "-0.03em", lineHeight: 1.05 }}
                  gutterBottom
                >
                  Nihon-go!
                </Typography>

                <Typography
                  variant={isMobile ? "body1" : "h6"}
                  sx={{ opacity: 0.85, maxWidth: 560, mx: { xs: "auto", md: 0 } }}
                  mb={3}
                >
                  Learn Japanese in a fun, effective, and cultural way
                </Typography>

                <Stack
                  spacing={1.5}
                  sx={{ width: { xs: "100%", sm: 420 }, mx: { xs: "auto", md: 0 } }}
                >
                  <Button
                    variant="contained"
                    onClick={() => go("/dashboard", "/auth")}
                    sx={{
                      bgcolor: "#b43d20",
                      borderRadius: 2.5,
                      minHeight: 52,
                      fontWeight: 900,
                      "&:hover": { bgcolor: "#9f341b" },
                    }}
                  >
                    Start Now!
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={() => go("/dashboard", "/auth")}
                    sx={{
                      color: "#b43d20",
                      borderColor: "rgba(180,61,32,0.65)",
                      borderWidth: 2,
                      borderRadius: 2.5,
                      minHeight: 52,
                      fontWeight: 900,
                    }}
                  >
                    Learn more
                  </Button>
                </Stack>

                <Box
                  sx={{
                    mt: 3,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    justifyContent: { xs: "center", md: "flex-start" },
                  }}
                >
                  {[
                    "Everyday Phrases",
                    "Emergencies",
                    "Work Culture",
                    "Travel Japan",
                    "Polite Speech",
                  ].map((label) => (
                    <Chip
                      key={label}
                      label={label}
                      variant="outlined"
                      sx={{
                        fontWeight: 800,
                        borderColor: "rgba(180,61,32,0.45)",
                        color: "#b43d20",
                        bgcolor: "rgba(255,255,255,0.5)",
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Grid>

            {/* RIGHT */}
            <Grid item xs={12} md={5}>
              <Card
                elevation={8}
                sx={{
                  borderRadius: 4,
                  bgcolor: "rgba(255,255,255,0.95)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <CardContent sx={{ textAlign: "left" }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={900}
                    sx={{ opacity: 0.75 }}
                  >
                    Try a quick sample
                  </Typography>

                  <Typography variant="h6" fontWeight={900} sx={{ mt: 0.5 }}>
                    Greetings 👋
                  </Typography>

                  <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
                    "はじめまして" — Nice to meet you
                  </Typography>

                  <Button
                    fullWidth
                    variant="outlined"
                    sx={{
                      mt: 2,
                      borderRadius: 2.5,
                      minHeight: 46,
                      borderWidth: 2,
                      borderColor: "#b43d20",
                      color: "#b43d20",
                      fontWeight: 900,
                    }}
                    onClick={() => go("/dashboard", "/auth")}
                  >
                    Open Sample Lesson
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ABOUT */}
      {sectionBox(
        "#91a7b9",
        <>
          <Typography
            variant={isMobile ? "h5" : "h4"}
            fontWeight="bold"
            gutterBottom
          >
            About Us
          </Typography>
          <Typography align="center">
            We built this platform to help learners master practical Japanese for
            daily life, emergencies, and work — while enjoying culture, history,
            and fun.
          </Typography>
        </>
      )}

      {/* FEATURES */}
      {sectionBox(
        "#d3d3d3",
        <>
          <Typography
            variant={isMobile ? "h5" : "h4"}
            fontWeight="bold"
            gutterBottom
          >
            Features
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              {featureCard("Learn Useful Japanese", "Practical phrases for real life")}
            </Grid>
            <Grid item xs={12} md={4}>
              {featureCard("Gamified Learning", "Levels, rewards, and exploration")}
            </Grid>
            <Grid item xs={12} md={4}>
              {featureCard("Cultural Context", "Language + culture together")}
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default Home;
