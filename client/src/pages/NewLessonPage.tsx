import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { useNavigate, useParams } from "react-router-dom";

import PronunciationExercise, { PronunciationExerciseData } from "../components/PronunciationExercise";
import NewLessonPageItem from "../components/NewLessonPageItem";
import MatchingExercisePlaceholder from "../components/MatchingExercisePlaceholder";
import MatchAudioExercisePlaceholder from "../components/MatchAudioExercisePlaceholder";
import DragDrop from "../components/DragDrop";
import DragDropPlaceholder from "../components/DragDropPlaceholder";
import Fact from "../components/Fact";

import { getNewLesson, NewLessonDoc, NewLessonItem } from "../services/newLessons";
import { expandLessonItems } from "../utils/expandLessonItems";

// ── Step helpers (mirrors Lesson.tsx conventions) ────────────────────────────

function stepLabelFromType(type: string): string {
  switch (type) {
    case "page": return "Lesson";
    case "pronunciationExercise": return "Pronunciation";
    case "matchingExercise": return "Matching";
    case "matchAudioExercise": return "Listen";
    case "dragAndDropExercise": return "Drag & Drop";
    case "infoBreak": return "Note";
    case "lifeUsefulFact": return "Life Tip";
    default: return "Step";
  }
}

function stepIconFromType(type: string): string {
  switch (type) {
    case "page": return "📖";
    case "pronunciationExercise": return "🎙";
    case "matchingExercise": return "🔗";
    case "matchAudioExercise": return "🎧";
    case "dragAndDropExercise": return "✋";
    case "infoBreak": return "💡";
    case "lifeUsefulFact": return "🌟";
    default: return "📌";
  }
}

// ── Item renderer ─────────────────────────────────────────────────────────────

function renderItem(
  item: NewLessonItem,
  onResult: (r: { result: "correct" | "incorrect" }) => void,
  allMatchAudioItems: any[]
): React.ReactNode {
  const type = item.type as string;

  if (type === "pronunciationExercise") {
    return (
      <PronunciationExercise
        exercise={item as unknown as PronunciationExerciseData}
      />
    );
  }

  if (type === "page") {
    return <NewLessonPageItem item={item} />;
  }

  if (type === "matchingExercise") {
    return <MatchingExercisePlaceholder item={item as any} onResult={onResult} />;
  }

  if (type === "matchAudioExercise") {
    return <MatchAudioExercisePlaceholder item={item as any} allItems={allMatchAudioItems} onResult={onResult} />;
  }

  if (type === "dragAndDropExercise") {
    const term = (item as any)._term as string | undefined;
    const placeholderBank = ["〇", "〇", "〇", "〇", "〇"];
    return (
      <DragDrop
        prompt={term ? `Build: "${term}"` : ((item as any).description || "Build the correct phrase")}
        characterBank={placeholderBank}
        correctAnswer="〇〇〇"
        onResult={onResult}
      />
    );
  }

  if (type === "infoBreak") {
    return (
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
        <Box
          sx={{
            borderRadius: "20px",
            border: "1px solid rgba(0,0,0,0.08)",
            bgcolor: "#FFFFFF",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            px: { xs: 2.5, sm: 3 },
            py: { xs: 2.5, sm: 3 },
          }}
        >
          <Typography sx={{ fontSize: { xs: "1rem", sm: "1.1rem" }, lineHeight: 1.7, color: "#374151" }}>
            {String((item as any).content || "")}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (type === "lifeUsefulFact") {
    return (
      <Fact
        title="Life Tip 🌟"
        description={String((item as any).content || "")}
      />
    );
  }

  // Unknown type — styled placeholder so page never looks broken
  return (
    <Box sx={{ width: "100%", maxWidth: 480, mx: "auto", textAlign: "center", px: 2 }}>
      <Typography sx={{ fontWeight: 700, color: "text.secondary" }}>
        {type}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.disabled" }}>
        This content type will be rendered in a future update
      </Typography>
    </Box>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

const NewLessonPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<NewLessonDoc | null>(null);
  const [step, setStep] = useState(0);

  const stepKeysSeen = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!slug) { navigate("/dashboard", { replace: true }); return; }

    let mounted = true;
    void (async () => {
      try {
        setLoading(true);
        const doc = await getNewLesson(slug);
        if (mounted) { setLesson(doc); setStep(0); }
      } catch {
        if (mounted) navigate("/dashboard", { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, navigate]);

  // Expand placeholder exercises into one-per-term repetitions (re-randomised
  // each visit). Raw items change only when the lesson doc changes.
  const rawItems: NewLessonItem[] = useMemo(() => lesson?.items ?? [], [lesson]);
  const items: NewLessonItem[] = useMemo(() => expandLessonItems(rawItems), [rawItems]);

  // Distractor pool for matchAudioExercise — uses expanded items so every
  // generated phrase is available as a potential wrong-answer option.
  const allMatchAudioItems = useMemo(
    () => items.filter((it) => it.type === "matchAudioExercise") as any[],
    [items]
  );
  const totalSteps = items.length;
  const pct = totalSteps ? Math.round(((step + 1) / totalSteps) * 100) : 0;
  const isLast = step >= totalSteps - 1;
  const activeItem = items[step];
  const activeType = activeItem?.type as string ?? "";
  const lessonTitle = lesson?.lesson ?? "Lesson";

  const handleNext = () => {
    if (isLast) { navigate("/dashboard"); return; }
    setStep((s) => s + 1);
  };

  const handleResult = ({ result }: { result: "correct" | "incorrect" }) => {
    if (result === "correct") {
      setTimeout(() => setStep((s) => (s >= totalSteps - 1 ? s : s + 1)), 1000);
    }
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#F9F7F4" }}>
        <Stack alignItems="center" gap={2}>
          <CircularProgress sx={{ color: "#B43D20" }} />
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
            Loading lesson…
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (!lesson || !items.length) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#F9F7F4", px: 2 }}>
        <Paper
          elevation={0}
          sx={{ p: 4, borderRadius: 4, maxWidth: 480, width: "100%", border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}
        >
          <Typography variant="h2" sx={{ mb: 1 }}>📭</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Lesson unavailable</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            This lesson may be inactive or missing content.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/dashboard")}
            sx={{ bgcolor: "#B43D20", "&:hover": { bgcolor: "#9D351C" }, borderRadius: 999, fontWeight: 700 }}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100dvh", display: "flex", flexDirection: "column", bgcolor: "#F9F7F4", overflow: "hidden" }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          zIndex: 10,
          backdropFilter: "blur(12px)",
          bgcolor: "rgba(249,247,244,0.85)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}
      >
        <Container maxWidth="md" sx={{ py: 1.5 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                noWrap
                sx={{ fontWeight: 900, fontSize: { xs: "0.95rem", sm: "1.05rem" }, letterSpacing: "-0.01em" }}
              >
                {lessonTitle}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.25 }}>
                <Chip
                  size="small"
                  label={`${stepIconFromType(activeType)} ${stepLabelFromType(activeType)} · ${step + 1}/${totalSteps}`}
                  sx={{ fontWeight: 700, fontSize: "0.72rem", height: 22 }}
                />
              </Stack>
            </Box>

            <Button
              startIcon={<LogoutRoundedIcon />}
              variant="contained"
              size="small"
              onClick={() => navigate("/dashboard")}
              sx={{
                bgcolor: "#B43D20",
                "&:hover": { bgcolor: "#9D351C" },
                borderRadius: 999,
                fontWeight: 700,
                fontSize: "0.78rem",
              }}
            >
              Save & Exit
            </Button>
          </Stack>

          <Box sx={{ mt: 1.25 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 6,
                borderRadius: 999,
                bgcolor: "rgba(0,0,0,0.06)",
                "& .MuiLinearProgress-bar": { borderRadius: 999, bgcolor: "#B43D20", transition: "transform 0.5s ease" },
              }}
            />
          </Box>
        </Container>
      </Box>

      {/* ── Content card (fills remaining height, scrolls only if needed) ─── */}
      <Box sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <Container maxWidth="md" sx={{ pt: { xs: 1.5, md: 2 }, pb: { xs: 1.5, md: 2 }, flex: 1, display: "flex", flexDirection: "column" }}>
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRadius: { xs: 3, md: 4 },
              border: "1px solid rgba(0,0,0,0.07)",
              bgcolor: "#FFFFFF",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            {/* Exercise area */}
            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                px: { xs: 1.5, md: 3 },
                py: { xs: 2, md: 2.5 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {activeItem && (
                <Box key={`step-${step}`} sx={{ width: "100%" }}>
                  {renderItem(activeItem, handleResult, allMatchAudioItems)}
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* ── Bottom nav (in normal flow, not fixed) ────────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          bgcolor: "rgba(255,255,255,0.92)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Container maxWidth="md" sx={{ py: { xs: 1.25, md: 1.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button
              disabled={step === 0}
              onClick={handleBack}
              variant="outlined"
              sx={{
                minWidth: 96,
                borderRadius: 999,
                fontWeight: 700,
                borderColor: "rgba(0,0,0,0.15)",
                color: "text.secondary",
              }}
            >
              ← Back
            </Button>

            <Button
              onClick={handleNext}
              variant="contained"
              sx={{
                minWidth: 120,
                borderRadius: 999,
                fontWeight: 900,
                bgcolor: "#B43D20",
                "&:hover": { bgcolor: "#9D351C" },
                boxShadow: "0 4px 14px rgba(180,61,32,0.35)",
              }}
            >
              {isLast ? "Finish 🎉" : "Next →"}
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default NewLessonPage;
