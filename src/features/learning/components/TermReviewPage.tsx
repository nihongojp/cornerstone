"use client";

import React from "react";
import { Box, Container, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Link from "next/link";

import TermCard from "@/features/learning/components/TermCard";
import ReviewNavArrows from "@/features/learning/components/ReviewNavArrows";
import { lessonHref } from "@/lib/content/routes";
import type { Lesson, Term } from "@/payload/payload-types";

const BRAND = "#B43D20";

const TermReviewPage: React.FC<{
  lesson: Lesson;
  terms: Term[];
  prevHref?: string;
  nextHref?: string;
}> = ({ lesson, terms, prevHref, nextHref }) => (
  <Box sx={{ minHeight: "100vh", bgcolor: "#F9F7F4" }}>
    <ReviewNavArrows
      prevHref={prevHref}
      nextHref={nextHref}
      prevLabel="Previous lesson review"
      nextLabel="Next lesson review"
    />
    <Container maxWidth="md" sx={{ pt: 5, pb: 8, px: { xs: 7, md: 3 } }}>
      <Box
        component={Link}
        href={lessonHref(lesson.slug)}
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
        Back to lesson
      </Box>

      <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.4rem", sm: "1.7rem" }, mb: 0.5 }}>
        {lesson.cardTitle?.trim() || lesson.title}
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 4 }}>
        {terms.length
          ? `${terms.length} term${terms.length === 1 ? "" : "s"} from this lesson`
          : "This lesson has no terms to review yet."}
      </Typography>

      {terms.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          {terms.map((term) => (
            <TermCard key={term.id} term={term} />
          ))}
        </Box>
      )}
    </Container>
  </Box>
);

export default TermReviewPage;
