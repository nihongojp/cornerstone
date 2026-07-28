import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import { listNewLessons } from "../services/newLessons";
import { listLessons } from "../services/lessons";
import { getProgress } from "../services/progress";
import { isAuthed } from "../services/api";

// A card's color reflects the signed-in user's progress on that specific
// lesson version, rather than which column (Grammar vs Reading & Writing)
// it lives in.
type CardProgressStatus = "not_started" | "in_progress" | "completed";

// One playable variant of a lesson (a specific version).
type Version = {
  lesson: number;
  version: number;
  to: string;
  slug: string;
  cardTitle?: string;
  progressStatus?: CardProgressStatus;
};

// Sections are always shown for at least these lesson numbers.
const BASE_LESSON_NUMBERS = [1, 2, 3];

// Parse a lesson number + version out of a slug like:
//   "l1-v1"                     (newlessons / Grammar)
//   "hiragana-l2-v3-akita"      (prefecture / Reading & Writing)
function parseSlug(slug: string): { lesson: number; version: number } | null {
  const m = /l(\d+)-v(\d+)/i.exec(slug || "");
  if (!m) return null;
  return { lesson: Number(m[1]), version: Number(m[2]) };
}

function pushVersion(map: Map<number, Version[]>, lesson: number, v: Version) {
  const arr = map.get(lesson) ?? [];
  arr.push(v);
  map.set(lesson, arr);
}

// Reading & Writing cards title themselves after the hiragana/katakana pairs
// they cover (e.g. "あ/ア、い/イ、う/ウ"), matching the format Lesson 1 was
// given manually. Deriving it from the flashcards means every lesson gets
// the same treatment without needing a cardTitle typed into MongoDB.
function deriveReadingCardTitle(flashcards?: string[]): string | undefined {
  return flashcards && flashcards.length ? flashcards.join("、") : undefined;
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

// A single version rendered as a card: the big title up top (MongoDB's
// cardTitle field when set — e.g. Grammar lessons — otherwise derived
// automatically for Reading & Writing, with a placeholder only if neither
// is available), and the auto-numbered "Lesson N.M" shown as the caption
// underneath.
const VersionCard: React.FC<{ v: Version }> = ({ v }) => {
  const status = v.progressStatus ?? "not_started";
  const sx = CARD_STYLE_BY_STATUS[status];
  const captionColor = CAPTION_COLOR_BY_STATUS[status];

  return (
    <Paper component={Link} to={v.to} elevation={0} sx={sx}>
      {v.cardTitle ? (
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
          {v.cardTitle}
        </Typography>
      ) : (
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", fontStyle: "italic", color: captionColor }}>
          Add a title
        </Typography>
      )}
      <Typography sx={{ fontSize: "0.78rem", color: captionColor, mt: 0.5 }}>
        Lesson {v.lesson}.{v.version}
      </Typography>
    </Paper>
  );
};

// A titled column of version cards (or a placeholder if empty).
const LessonColumn: React.FC<{
  heading: string;
  versions: Version[];
}> = ({ heading, versions }) => {
  const sorted = [...versions].sort((a, b) => a.version - b.version);

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
          {sorted.map((v) => (
            <VersionCard key={v.to} v={v} />
          ))}
        </Stack>
      ) : (
        <Placeholder />
      )}
    </Box>
  );
};

const NewLessonsListPage: React.FC = () => {
  const [grammar, setGrammar] = useState<Map<number, Version[]>>(new Map());
  const [reading, setReading] = useState<Map<number, Version[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      // Fetch each source independently so one failing still shows the other's content.
      const [newLessons, prefLessons] = await Promise.all([
        listNewLessons().catch(() => []),
        listLessons().catch(() => []),
      ]);
      if (!mounted) return;

      // Grammar column ← newlessons (slug like "l1-v1").
      const grammarMap = new Map<number, Version[]>();
      for (const l of newLessons) {
        const p = parseSlug(l.slug);
        if (p) pushVersion(grammarMap, p.lesson, { lesson: p.lesson, version: p.version, to: `/newlesson/${l.slug}`, slug: l.slug, cardTitle: l.cardTitle });
      }

      // Reading & Writing column ← prefecture lessons (slug like "hiragana-l1-v2-hokkaido").
      const readingMap = new Map<number, Version[]>();
      for (const l of prefLessons) {
        const p = parseSlug(l.slug);
        if (p) {
          pushVersion(readingMap, p.lesson, {
            lesson: p.lesson,
            version: p.version,
            to: `/lesson/${l.slug}`,
            slug: l.slug,
            cardTitle: l.cardTitle || deriveReadingCardTitle(l.flashcards),
          });
        }
      }

      // Look up each version's saved progress (by the same slug the lesson
      // pages themselves use as their progress key) so cards can be colored
      // by "not started" / "in progress" / "completed" instead of column.
      // getProgress() already swallows per-request failures and resolves to
      // null, so one bad lookup can't break the rest of the list.
      if (isAuthed()) {
        const allVersions = [...grammarMap.values(), ...readingMap.values()].flat();
        const docs = await Promise.all(allVersions.map((v) => getProgress(v.slug)));
        allVersions.forEach((v, i) => {
          v.progressStatus = docs[i]?.status ?? "not_started";
        });
      }

      if (!mounted) return;
      setGrammar(grammarMap);
      setReading(readingMap);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // Show the base sections plus any additional lesson numbers found in the data.
  const lessonNumbers = Array.from(
    new Set<number>([...BASE_LESSON_NUMBERS, ...grammar.keys(), ...reading.keys()])
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

        {loading ? (
          <Stack alignItems="center" gap={2} sx={{ pt: 6 }}>
            <CircularProgress sx={{ color: "#B43D20" }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Loading lessons…
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {lessonNumbers.map((n) => (
              <Box key={n}>
                {/* Section header */}
                <Typography sx={{ fontWeight: 800, fontSize: "1.15rem", color: "#1C1917", mb: 1.5 }}>
                  Lesson {n}
                </Typography>

                {/* Two columns side by side; each stacks its versions vertically. */}
                <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems="flex-start">
                  <LessonColumn heading="Grammar" versions={grammar.get(n) ?? []} />
                  <LessonColumn heading="Reading & Writing" versions={reading.get(n) ?? []} />
                </Stack>
              </Box>
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default NewLessonsListPage;
