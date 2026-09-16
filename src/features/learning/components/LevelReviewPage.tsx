"use client";

import React from "react";
import { Box, Container, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Link from "next/link";

import TermCard from "@/features/learning/components/TermCard";
import ReviewNavArrows from "@/features/learning/components/ReviewNavArrows";
import { lessonHref, levelReviewHref } from "@/lib/content/routes";
import type { Lesson, Term } from "@/payload/payload-types";

const BRAND = "#B43D20";

/** One lesson document's part number and title, plus the terms it taught. */
export type ReviewPart = {
  slug: string;
  part: number;
  title: string;
  terms: Term[];
};

const PartSection: React.FC<{ part: ReviewPart }> = ({ part }) => (
  <Box sx={{ mb: 4 }}>
    <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1.5, gap: 1 }}>
      <Typography
        component={Link}
        href={lessonHref(part.slug)}
        sx={{
          fontWeight: 800,
          fontSize: "1rem",
          color: "#1C1917",
          textDecoration: "none",
          "&:hover": { color: BRAND },
        }}
      >
        {part.title}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", flexShrink: 0 }}>
        {part.terms.length} term{part.terms.length === 1 ? "" : "s"}
      </Typography>
    </Box>

    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
        gap: 2,
      }}
    >
      {part.terms.map((term) => (
        <TermCard key={term.id} term={term} />
      ))}
    </Box>
  </Box>
);

const FormatSection: React.FC<{ heading: string; parts: ReviewPart[] }> = ({ heading, parts }) => {
  const withTerms = parts.filter((p) => p.terms.length > 0);
  if (!withTerms.length) return null;

  return (
    <Box sx={{ mb: 5 }}>
      <Typography
        sx={{
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "text.secondary",
          mb: 2,
        }}
      >
        {heading}
      </Typography>
      {withTerms.map((part) => (
        <PartSection key={part.slug} part={part} />
      ))}
    </Box>
  );
};

/*
 * Every term taught under one numbered lesson — every part, both formats.
 * A learner reaches this from the icon beside "Lesson N" on the list page,
 * not from a single lesson's own review link (`TermReviewPage`), which only
 * ever covers the one document it was reached from.
 */
const LevelReviewPage: React.FC<{
  level: number;
  grammar: ReviewPart[];
  reading: ReviewPart[];
  prevLevel?: number;
  nextLevel?: number;
}> = ({ level, grammar, reading, prevLevel, nextLevel }) => {
  const totalTerms = [...grammar, ...reading].reduce((sum, p) => p.terms.length + sum, 0);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F9F7F4" }}>
      <ReviewNavArrows
        prevHref={prevLevel !== undefined ? levelReviewHref(prevLevel) : undefined}
        nextHref={nextLevel !== undefined ? levelReviewHref(nextLevel) : undefined}
        prevLabel={prevLevel !== undefined ? `Lesson ${prevLevel} review` : "Previous lesson review"}
        nextLabel={nextLevel !== undefined ? `Lesson ${nextLevel} review` : "Next lesson review"}
      />
      <Container maxWidth="md" sx={{ pt: 5, pb: 8, px: { xs: 7, md: 3 } }}>
        <Box
          component={Link}
          href="/lessons"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            mb: 3,
            color: "text.secondary",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
            "&:hover": { color: BRAND },
          }}
        >
          <ArrowBackRoundedIcon fontSize="small" />
          Back to lessons
        </Box>

        <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.4rem", sm: "1.7rem" }, mb: 0.5 }}>
          Lesson {level} — Review
        </Typography>
        <Typography sx={{ color: "text.secondary", mb: 4 }}>
          {totalTerms
            ? `${totalTerms} term${totalTerms === 1 ? "" : "s"} across Lesson ${level}`
            : "Nothing to review here yet."}
        </Typography>

        <FormatSection heading="Grammar" parts={grammar} />
        <FormatSection heading="Reading & Writing" parts={reading} />
      </Container>
    </Box>
  );
};

export default LevelReviewPage;
