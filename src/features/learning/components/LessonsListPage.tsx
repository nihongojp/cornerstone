"use client";

import React, { useMemo } from "react";
import { Box, Container, Paper, Stack, Typography } from "@mui/material";
import Link from "next/link";

import { lessonHref } from "@/lib/content/routes";
import { termText } from "@/features/exercises/components/termText";
import type { Lesson, Term } from "@/payload/payload-types";
import type { ProgressStatus } from "@/features/learning/types";

// A card's color reflects the signed-in user's progress on that specific
// part, rather than which column (Grammar vs Reading & Writing) it lives in.
type CardProgressStatus = "not_started" | "in_progress" | "completed";

/*
 * One playable card: a single part of a numbered lesson.
 *
 * `level` and `part` are read straight off the document. They used to be
 * recovered from the slug with `/l(\d+)-v(\d+)/`, which meant renaming a slug
 * silently reshuffled this page.
 */
type Part = {
  level: number;
  part: number;
  to: string;
  slug: string;
  cardTitle?: string;
  progressStatus?: CardProgressStatus;
};

// Sections are always shown for at least these levels.
const BASE_LEVELS = [1, 2, 3];

function pushPart(map: Map<number, Part[]>, level: number, p: Part) {
  const arr = map.get(level) ?? [];
  arr.push(p);
  map.set(level, arr);
}

// Reading & Writing cards title themselves after the hiragana/katakana pairs
// they cover (e.g. "あ/ア、い/イ、う/ウ"), matching the format Lesson 1 was
// given manually. Deriving it from the flashcards means every lesson gets
// the same treatment without needing a cardTitle typed into MongoDB.
/*
 * A Reading & Writing card with no title of its own shows the characters it
 * teaches — "あ、い、う…".
 *
 * The strings used to arrive pre-flattened on the list item, because
 * `flashcardDeck.cards` was an array of strings on the block. A deck references
 * catalogue terms now, so the characters come off the terms — which is also why
 * the list read populates to `CONTENT_DEPTH`: at depth 0 every term would be a
 * bare id and every card here would fall back to "Add a title".
 */
function deriveReadingCardTitle(lesson: Lesson): string | undefined {
  const characters = (lesson.steps ?? [])
    .flatMap((step) => step.components ?? [])
    // A predicate rather than a plain `filter`: `components` is a union of every
    // block type, and only the narrowed one has `terms`.
    .filter(
      (block): block is Extract<typeof block, { blockType: "vocabList" }> =>
        block.blockType === "vocabList" && block.layout === "flashcards"
    )
    .flatMap((block) => block.terms ?? [])
    .map((term) => termText(term as Term | number))
    .filter(Boolean);

  return characters.length ? characters.join("、") : undefined;
}

const cardBase = {
  p: 2,
  borderRadius: "16px",
  textDecoration: "none",
  display: "block",
  transition: "transform 0.15s, box-shadow 0.15s",
  "&:hover": { transform: "translateY(-2px)" },
};

// Not started: the neutral/default look — white with a subtle brand-tinted
// border. Same for every card regardless of column.
const notStartedCard = {
  ...cardBase,
  bgcolor: "#fff",
  border: "1.5px solid rgba(180,61,32,0.4)",
  "&:hover": { ...cardBase["&:hover"], border: "1.5px solid #B43D20", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" },
};

// In progress: opened but not finished — a light brand-color tint so it
// reads as "underway" without the full weight of the completed style.
const inProgressCard = {
  ...cardBase,
  bgcolor: "rgba(180,61,32,0.10)",
  border: "1.5px solid rgba(180,61,32,0.45)",
  color: "#1C1917",
  boxShadow: "0 2px 10px rgba(180,61,32,0.12)",
  "&:hover": { ...cardBase["&:hover"], border: "1.5px solid #B43D20", boxShadow: "0 8px 20px rgba(180,61,32,0.22)" },
};

// Completed: the strongest signal — filled brand color, matching the app's
// existing "primary" card treatment.
const completedCard = {
  ...cardBase,
  bgcolor: "#B43D20",
  color: "#fff",
  boxShadow: "0 2px 12px rgba(180,61,32,0.18)",
  "&:hover": { ...cardBase["&:hover"], boxShadow: "0 8px 24px rgba(180,61,32,0.28)" },
};

const CARD_STYLE_BY_STATUS: Record<CardProgressStatus, object> = {
  not_started: notStartedCard,
  in_progress: inProgressCard,
  completed: completedCard,
};

const CAPTION_COLOR_BY_STATUS: Record<CardProgressStatus, string> = {
  not_started: "rgba(0,0,0,0.35)",
  in_progress: "rgba(0,0,0,0.45)",
  completed: "rgba(255,255,255,0.7)",
};

// Placeholder shown when a column has no versions yet.
const Placeholder: React.FC = () => (
  <Box
    sx={{
      p: 2,
      borderRadius: "16px",
      border: "1.5px dashed rgba(0,0,0,0.18)",
      bgcolor: "rgba(0,0,0,0.02)",
      textAlign: "center",
    }}
  >
    <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(0,0,0,0.38)" }}>
      Coming soon
    </Typography>
  </Box>
);

// A single part rendered as a card: the big title up top (the `cardTitle`
// field when set — e.g. Grammar lessons — otherwise derived automatically for
// Reading & Writing, with a placeholder only if neither is available), and
// "Lesson <level>.<part>" shown as the caption underneath.
const PartCard: React.FC<{ p: Part }> = ({ p }) => {
  const status = p.progressStatus ?? "not_started";
  const sx = CARD_STYLE_BY_STATUS[status];
  const captionColor = CAPTION_COLOR_BY_STATUS[status];

  return (
    <Paper component={Link} href={p.to} elevation={0} sx={sx}>
      {p.cardTitle ? (
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
          {p.cardTitle}
        </Typography>
      ) : (
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", fontStyle: "italic", color: captionColor }}>
          Add a title
        </Typography>
      )}
      <Typography sx={{ fontSize: "0.78rem", color: captionColor, mt: 0.5 }}>
        Lesson {p.level}.{p.part}
      </Typography>
    </Paper>
  );
};

// A titled column of part cards (or a placeholder if empty).
const LessonColumn: React.FC<{
  heading: string;
  parts: Part[];
}> = ({ heading, parts }) => {
  const sorted = [...parts].sort((a, b) => a.part - b.part);

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "text.secondary",
          mb: 1,
        }}
      >
        {heading}
      </Typography>

      {sorted.length > 0 ? (
        <Stack gap={1.25}>
          {sorted.map((p) => (
            <PartCard key={p.to} p={p} />
          ))}
        </Stack>
      ) : (
        <Placeholder />
      )}
    </Box>
  );
};

const LessonsListPage: React.FC<{
  newLessons: Lesson[];
  lessons: Lesson[];
  progressBySlug: Record<string, ProgressStatus>;
}> = ({ newLessons, lessons: prefLessons, progressBySlug }) => {
  const { grammar, reading } = useMemo(() => {
    const grammarMap = new Map<number, Part[]>();
    for (const l of newLessons) {
      pushPart(grammarMap, l.level, {
        level: l.level,
        part: l.part,
        to: lessonHref(l.slug),
        slug: l.slug,
        cardTitle: l.cardTitle ?? undefined,
        progressStatus: progressBySlug[l.slug] ?? "not_started",
      });
    }

    const readingMap = new Map<number, Part[]>();
    for (const l of prefLessons) {
      pushPart(readingMap, l.level, {
        level: l.level,
        part: l.part,
        to: lessonHref(l.slug),
        slug: l.slug,
        cardTitle: l.cardTitle || deriveReadingCardTitle(l),
        progressStatus: progressBySlug[l.slug] ?? "not_started",
      });
    }

    return { grammar: grammarMap, reading: readingMap };
  }, [newLessons, prefLessons, progressBySlug]);

  // Show the base sections plus any additional levels found in the data.
  const levels = Array.from(
    new Set<number>([...BASE_LEVELS, ...grammar.keys(), ...reading.keys()])
  ).sort((a, b) => a - b);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F9F7F4" }}>
      <Container maxWidth="md" sx={{ pt: 5, pb: 8 }}>
        {/* Page title */}
        <Box sx={{ mb: 4 }}>
          <Typography
            sx={{ fontWeight: 900, fontSize: { xs: "1.6rem", sm: "2rem" }, letterSpacing: "-0.02em", color: "#1C1917" }}
          >
            Lessons
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Select a lesson to begin
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {levels.map((n) => (
              <Box key={n}>
                {/* Section header */}
                <Typography sx={{ fontWeight: 800, fontSize: "1.15rem", color: "#1C1917", mb: 1.5 }}>
                  Lesson {n}
                </Typography>

                {/* Two columns side by side; each stacks its parts vertically. */}
                <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems="flex-start">
                  <LessonColumn heading="Grammar" parts={grammar.get(n) ?? []} />
                  <LessonColumn heading="Reading & Writing" parts={reading.get(n) ?? []} />
                </Stack>
              </Box>
            ))}
          </Box>
      </Container>
    </Box>
  );
};

export default LessonsListPage;
