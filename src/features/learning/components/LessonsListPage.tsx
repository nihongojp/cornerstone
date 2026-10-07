"use client";

import React, { useMemo, useState } from "react";
import { Alert, Box, Container, IconButton, Paper, Stack, Typography } from "@mui/material";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import Link from "next/link";

import { lessonHref, levelReviewHref } from "@/lib/content/routes";
import { courseLevels } from "@/lib/content/levels";
import { deriveReadingCardTitle } from "@/features/learning/lessonTitles";
import NotesNotebookDialog from "@/features/learning/components/NotesNotebookDialog";
import type { Lesson } from "@/payload/payload-types";
import type { NotebookEntry, ProgressStatus } from "@/features/learning/types";

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

/** The title shown on a card, or the "Lesson N.M" fallback — same text a
 *  learner already sees, reused as the notebook's title for a blank note. */
function partTitle(p: Part): string {
  return p.cardTitle || `Lesson ${p.level}.${p.part}`;
}

function pushPart(map: Map<number, Part[]>, level: number, p: Part) {
  const arr = map.get(level) ?? [];
  arr.push(p);
  map.set(level, arr);
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
const PartCard: React.FC<{ p: Part; onOpenNotes: (p: Part) => void }> = ({ p, onOpenNotes }) => {
  const status = p.progressStatus ?? "not_started";
  const sx = CARD_STYLE_BY_STATUS[status];
  const captionColor = CAPTION_COLOR_BY_STATUS[status];

  return (
    <Paper component={Link} href={p.to} elevation={0} sx={{ ...sx, position: "relative" }}>
      {/* Stops the click from also following the card's own link — the icon
          opens the note, it does not start the lesson. */}
      <IconButton
        size="small"
        aria-label={`Notes for ${partTitle(p)}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenNotes(p);
        }}
        sx={{
          position: "absolute",
          top: 4,
          right: 4,
          color: status === "completed" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.35)",
          "&:hover": { color: status === "completed" ? "#fff" : "#B43D20" },
        }}
      >
        <StickyNote2RoundedIcon fontSize="small" />
      </IconButton>

      {p.cardTitle ? (
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", pr: 3 }}>
          {p.cardTitle}
        </Typography>
      ) : (
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", fontStyle: "italic", color: captionColor, pr: 3 }}>
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
  onOpenNotes: (p: Part) => void;
}> = ({ heading, parts, onOpenNotes }) => {
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
            <PartCard key={p.to} p={p} onOpenNotes={onOpenNotes} />
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
  /**
   * `null` when the progress lookup itself failed — distinct from an empty map,
   * which means "looked, found none". Colouring every card "not started" for a
   * failed lookup would read to a learner as lost progress.
   */
  progressBySlug: Record<string, ProgressStatus> | null;
  /** Every sticky note the signed-in learner has written. Empty when signed out. */
  notes: NotebookEntry[];
}> = ({ newLessons, lessons: prefLessons, progressBySlug, notes }) => {
  const progressUnavailable = progressBySlug === null;
  const [notesFor, setNotesFor] = useState<Part | null>(null);
  // Lifted out of the `notes` prop so a note saved in one card's popup is
  // reflected immediately if a different card's popup is opened next —
  // `notes` itself is only ever the server's answer as of page load.
  const [localNotes, setLocalNotes] = useState<NotebookEntry[]>(notes);
  const handleSaved: React.ComponentProps<typeof NotesNotebookDialog>["onSaved"] = (entry) => {
    setLocalNotes((prev) => {
      const rest = prev.filter((n) => n.lessonId !== entry.lessonId);
      return "cleared" in entry ? rest : [entry, ...rest];
    });
  };

  const { grammar, reading } = useMemo(() => {
    const statusOf = (slug: string): CardProgressStatus =>
      progressBySlug?.[slug] ?? "not_started";

    const grammarMap = new Map<number, Part[]>();
    for (const l of newLessons) {
      pushPart(grammarMap, l.level, {
        level: l.level,
        part: l.part,
        to: lessonHref(l.slug),
        slug: l.slug,
        cardTitle: l.cardTitle ?? undefined,
        progressStatus: statusOf(l.slug),
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
        progressStatus: statusOf(l.slug),
      });
    }

    return { grammar: grammarMap, reading: readingMap };
  }, [newLessons, prefLessons, progressBySlug]);

  // Show the base sections plus any additional levels found in the data.
  const levels = courseLevels([...grammar.keys(), ...reading.keys()]);

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

        {/*
         * Says "we couldn't read it" rather than showing every lesson as
         * untouched, which is what an empty map would have looked like.
         */}
        {progressUnavailable && (
          <Alert severity="info" sx={{ mb: 3 }}>
            We couldn&apos;t load your progress just now, so these cards show as not
            started. Your saved progress is safe — refresh to try again.
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {levels.map((n) => (
              <Box key={n}>
                {/* Section header */}
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "1.15rem", color: "#1C1917" }}>
                    Lesson {n}
                  </Typography>
                  <IconButton
                    component={Link}
                    href={levelReviewHref(n)}
                    size="small"
                    aria-label={`Review everything from Lesson ${n}`}
                    sx={{ color: "rgba(0,0,0,0.35)", "&:hover": { color: "#B43D20" } }}
                  >
                    <MenuBookRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>

                {/* Two columns side by side; each stacks its parts vertically. */}
                <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems="flex-start">
                  <LessonColumn heading="Grammar" parts={grammar.get(n) ?? []} onOpenNotes={setNotesFor} />
                  <LessonColumn heading="Reading & Writing" parts={reading.get(n) ?? []} onOpenNotes={setNotesFor} />
                </Stack>
              </Box>
            ))}
          </Box>
      </Container>

      {notesFor && (
        <NotesNotebookDialog
          open
          onClose={() => setNotesFor(null)}
          notes={localNotes}
          focusLesson={{ slug: notesFor.slug, title: partTitle(notesFor), href: notesFor.to }}
          onSaved={handleSaved}
        />
      )}
    </Box>
  );
};

export default LessonsListPage;
