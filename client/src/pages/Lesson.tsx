// src/pages/Lesson.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
  CircularProgress,
  Container,
  Paper,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import { useNavigate, useParams } from "react-router-dom";

import Flips from "../components/Flips";
import AudioMatch from "../components/AudioMatch";
import DragDrop from "../components/DragDrop";
import DotMatch from "../components/MatchDots";
import Fact from "../components/Fact";
import Reward from "../components/Rewards";
import RInfo from "../components/RewardInfo";

import { submitAttempt, upsertProgress } from "../services/progress";
import { isAuthed, safe } from "../services/api";
import { getLesson, LessonDoc } from "../services/lessons";

type ResultCb = (args: { result: "correct" | "incorrect"; detail?: any }) => void;
type StepSpec = { key: string; graded: boolean; comp: (on: ResultCb) => React.ReactNode };

type CardData = { id: number; front: string; back: string; audio?: string };

interface FlipsProps {
  onResult?: ResultCb;
  prompt?: string;
  cards?: CardData[];
}

interface AudioMatchProps {
  onResult?: ResultCb;
  options: string[];
  correctAnswer: string;
  audioUrl?: string;
  prompt?: string;
}

interface DragDropProps {
  onResult?: ResultCb;
  prompt?: string;
  characterBank?: string[];
  correctAnswer?: string;
  audioUrl?: string;
  imageUrl?: string;
  image?: string;
  bankItems?: string[];
  answer?: string[];
  caption?: string;
}

export type DotMatchPair = { hiragana: string; katakana: string };

interface DotMatchProps {
  onResult?: ResultCb;
  pairs: DotMatchPair[];
}

interface FactProps {
  title: string;
  description: string;
}

interface RewardProps {
  title: string;
  xp: number | string;
}

interface RewardInfoProps {
  title: string;
  description: string;
}

const FlipsC = Flips as unknown as React.FC<FlipsProps>;
const AudioC = AudioMatch as unknown as React.FC<AudioMatchProps>;
const DragC = DragDrop as unknown as React.FC<DragDropProps>;
const DotsC = DotMatch as unknown as React.FC<DotMatchProps>;
const FactC = Fact as unknown as React.FC<FactProps>;
const RewardC = Reward as unknown as React.FC<RewardProps>;
const RInfoC = RInfo as unknown as React.FC<RewardInfoProps>;

function splitPair(s: string): DotMatchPair {
  const [hiragana, katakana] = String(s).split("/");
  return { hiragana: hiragana ?? s, katakana: katakana ?? "" };
}

function normalizeChoiceLabel(s: string): string {
  const [a] = String(s).split("/");
  return a ?? s;
}

function resolveLessonIdentifier(lesson: LessonDoc): string {
  return (
    String((lesson as any).slug || "") ||
    String((lesson as any).id || "") ||
    String((lesson as any).lessonId || "") ||
    String((lesson as any)._id || "")
  );
}

function getLessonHeader(lesson: LessonDoc): string {
  const t = String((lesson as any).title || "Lesson");
  const v = String((lesson as any).version || "");
  return v ? `${t} (${v})` : t;
}

function stepKeyFromExercise(ex: any, fallbackIndex: number): string {
  return String(ex?.exerciseId || ex?._id || `${String(ex?.type || "exercise")}-${fallbackIndex}`);
}

function stepLabelFromKey(key: string): string {
  if (key === "flips") return "Flashcards";
  if (key === "fact") return "Fun Fact";
  if (key === "reward") return "Reward";
  if (key === "rinfo") return "Notes";
  if (key.includes("connectTheDots")) return "Connect Dots";
  if (key.includes("matchAudioLetter")) return "Audio Match";
  if (key.includes("vocabulary_drag_drop")) return "Drag & Drop";
  return "Exercise";
}

const STEP_ICONS: Record<string, string> = {
  flips: "🃏",
  fact: "💡",
  reward: "🏆",
  rinfo: "📝",
  connectTheDots: "🔗",
  matchAudioLetter: "🎧",
  vocabulary_drag_drop: "✋",
};

function stepIcon(key: string): string {
  for (const [k, v] of Object.entries(STEP_ICONS)) {
    if (key.includes(k)) return v;
  }
  return "📌";
}

function resolveExerciseImage(ex: any): string | undefined {
  const image = String(ex?.imageUrl || ex?.image || "").trim();
  return image || undefined;
}

const Lesson: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const lessonId = String(params.lessonId || "");

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<LessonDoc | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);

  const answeredStepRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;

    void (async (): Promise<void> => {
      try {
        setLoading(true);

        if (!lessonId) {
          navigate("/dashboard", { replace: true });
          return;
        }

        const l = await getLesson(lessonId);

        if (!mounted) return;

        setLesson(l);
        setDebugInfo({
          lessonIdParam: lessonId,
          receivedKeys: l ? Object.keys(l as any) : [],
          slug: (l as any)?.slug,
          _id: (l as any)?._id,
          flashcardsLen: ((l as any)?.flashcards || []).length,
          exercisesLen: ((l as any)?.exercises || []).length,
          exerciseTypes: ((l as any)?.exercises || []).map((x: any) => x?.type),
          exerciseImages: ((l as any)?.exercises || []).map((x: any) => ({
            exerciseId: x?.exerciseId,
            imageUrl: x?.imageUrl,
            image: x?.image,
          })),
          prefecture: (l as any)?.prefecture,
        });

        setStep(0);
        setCorrectCount(0);
        setAttemptCount(0);
        answeredStepRef.current = {};
      } catch (e) {
        console.error("[Lesson] fetch failed:", e);
        navigate("/dashboard", { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [lessonId, navigate]);

  const lessonKey = useMemo(() => (lesson ? resolveLessonIdentifier(lesson) : ""), [lesson]);

  const steps: StepSpec[] = useMemo(() => {
    if (!lesson) return [];

    const out: StepSpec[] = [];
    const flashcards: string[] = (lesson as any).flashcards || [];

    if (flashcards.length) {
      out.push({
        key: "flips",
        graded: true,
        comp: (on) => {
          const cardData: CardData[] = flashcards.map((raw, idx) => ({
            id: idx,
            front: raw,
            back: "",
          }));

          return <FlipsC onResult={on} prompt="Flip each card to review." cards={cardData} />;
        },
      });
    }

    const exercises: any[] = (lesson as any).exercises || [];

    exercises.forEach((ex, i) => {
      const exType = String(ex?.type || "");
      const key = stepKeyFromExercise(ex, i);

      if (exType === "connectTheDots") {
        out.push({
          key,
          graded: true,
          comp: (on) => <DotsC onResult={on} pairs={(ex.items || []).map(splitPair)} />,
        });
        return;
      }

      if (exType === "matchAudioLetter") {
        // Dedupe so the same answer never appears twice among the choices —
        // source data (ex.items) isn't guaranteed unique.
        const rawOptions: string[] = (ex.items || []).map(normalizeChoiceLabel);
        const options = Array.from(new Set(rawOptions));
        const correctAnswer = normalizeChoiceLabel((ex.correctAnswers || [])[0] || options[0] || "");

        out.push({
          key,
          graded: true,
          comp: (on) => (
            <AudioC
              onResult={on}
              options={options}
              correctAnswer={correctAnswer}
              audioUrl={ex.audioUrl}
              prompt={ex.prompt || "Listen and choose the right character"}
            />
          ),
        });
        return;
      }

      if (exType === "vocabulary_drag_drop") {
        out.push({
          key,
          graded: true,
          comp: (on) => (
            <DragC
              onResult={on}
              prompt={ex.prompt || "Build the correct word"}
              characterBank={ex.characterBank || []}
              correctAnswer={ex.correctAnswer}
              audioUrl={ex.audioUrl}
              imageUrl={resolveExerciseImage(ex)}
            />
          ),
        });
        return;
      }

      console.warn("[Lesson] unknown exercise type:", exType, ex);
    });

    if ((lesson as any).funFact) {
      out.push({
        key: "fact",
        graded: false,
        comp: () => <FactC title="Fun Fact" description={String((lesson as any).funFact || "")} />,
      });
    }

    if ((lesson as any).achievement?.title || (lesson as any).achievement?.xp !== undefined) {
      out.push({
        key: "reward",
        graded: false,
        comp: () => (
          <RewardC
            title={String((lesson as any).achievement?.title || "Lesson Complete!")}
            xp={(lesson as any).achievement?.xp ?? 0}
          />
        ),
      });
    }

    if ((lesson as any).notes) {
      out.push({
        key: "rinfo",
        graded: false,
        comp: () => <RInfoC title="Notes" description={String((lesson as any).notes || "")} />,
      });
    }

    return out;
  }, [lesson]);

  const pct = steps.length ? Math.round(((step + 1) / steps.length) * 100) : 0;
  const accuracy = attemptCount ? Math.round((100 * correctCount) / attemptCount) : 0;

  useEffect(() => {
    if (!lesson || !isAuthed() || !lessonKey) return;

    void (async (): Promise<void> => {
      try {
        await upsertProgress({
          lessonId: lessonKey,
          status: "in_progress",
          lastStep: 0,
          accuracyPct: 0,
        });
      } catch (e) {
        console.error("[Progress] upsert failed:", e);
      }
    })();
  }, [lesson, lessonKey]);

  function advance({
    result,
    detail,
    createAttempt,
    stepKey,
  }: {
    result: "correct" | "incorrect";
    detail?: any;
    createAttempt: boolean;
    stepKey: string;
  }) {
    if (answeredStepRef.current[stepKey]) return;

    answeredStepRef.current[stepKey] = true;

    const isLastStep = step >= steps.length - 1;
    const nextAttemptCount = attemptCount + (createAttempt ? 1 : 0);
    const nextCorrectCount = createAttempt && result === "correct" ? correctCount + 1 : correctCount;
    const nextAccuracy = nextAttemptCount ? Math.round((100 * nextCorrectCount) / nextAttemptCount) : accuracy;

    setAttemptCount(nextAttemptCount);
    setCorrectCount(nextCorrectCount);

    if (lesson && isAuthed() && createAttempt && lessonKey) {
      void submitAttempt({ lessonId: lessonKey, stepIndex: step, result, detail });
    }

    if (!isLastStep) {
      const nextStep = step + 1;
      setStep(nextStep);

      if (lesson && isAuthed() && lessonKey) {
        void upsertProgress({
          lessonId: lessonKey,
          status: "in_progress",
          lastStep: nextStep,
          accuracyPct: nextAccuracy,
        });
      }
    } else {
      if (lesson && isAuthed() && lessonKey) {
        void upsertProgress({
          lessonId: lessonKey,
          status: "completed",
          lastStep: step,
          accuracyPct: nextAccuracy,
        });
      }

      navigate("/dashboard");
    }
  }

  const handleResult = (args: { result: "correct" | "incorrect"; detail?: any }) => {
    const k = steps[step]?.key || String(step);

    if (args.result === "correct") {
      setTimeout(() => {
        advance({ ...args, createAttempt: true, stepKey: k });
      }, 900);
    } else {
      setTimeout(() => {
        setAttemptCount((c) => c + 1);
      }, 700);

      if (lesson && isAuthed() && lessonKey) {
        void submitAttempt({
          lessonId: lessonKey,
          stepIndex: step,
          result: "incorrect",
          detail: args.detail,
        });
      }
    }
  };

  const handleSkip = safe(async () => {
    const graded = steps[step]?.graded ?? false;
    const k = steps[step]?.key || String(step);

    advance({
      result: "incorrect",
      detail: { skipped: true },
      createAttempt: graded,
      stepKey: k,
    });
  });

  const handleNext = () => {
    const graded = steps[step]?.graded ?? false;
    const k = steps[step]?.key || String(step);

    advance({
      result: graded ? "incorrect" : "correct",
      detail: graded ? { nextOnGraded: true } : { informational: true },
      createAttempt: graded,
      stepKey: k,
    });
  };

  const handleBack = () => {
    const prevStep = Math.max(0, step - 1);
    const prevKey = steps[prevStep]?.key;

    if (prevKey) delete answeredStepRef.current[prevKey];

    setStep(prevStep);
  };

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

  if (!lesson || !steps.length) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#F9F7F4", px: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 4,
            maxWidth: 480,
            width: "100%",
            border: "1px solid rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <Typography variant="h2" sx={{ mb: 1 }}>
            📭
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Lesson unavailable
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            This lesson may be inactive or missing content.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/dashboard")}
            sx={{
              bgcolor: "#B43D20",
              "&:hover": { bgcolor: "#9D351C" },
              borderRadius: 999,
              fontWeight: 700,
            }}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  const activeKey = steps[step]?.key || String(step);
  const activeLabel = stepLabelFromKey(activeKey);
  const isLast = step >= steps.length - 1;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F9F7F4", pb: { xs: 12, md: 8 } }}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(12px)",
          bgcolor: "rgba(249,247,244,0.85)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}
      >
        <Container maxWidth="md" sx={{ py: 1.5 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Button
              startIcon={<ArrowBackRoundedIcon />}
              variant="text"
              onClick={() => navigate("/dashboard")}
              sx={{
                fontWeight: 700,
                color: "text.secondary",
                "&:hover": { color: "text.primary" },
                minWidth: 0,
              }}
            >
              Back
            </Button>

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                noWrap
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "0.95rem", sm: "1.05rem" },
                  letterSpacing: "-0.01em",
                }}
              >
                {getLessonHeader(lesson)}
              </Typography>

              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mt: 0.25 }}>
                <Chip
                  size="small"
                  label={`${stepIcon(activeKey)} ${activeLabel} · ${step + 1}/${steps.length}`}
                  sx={{ fontWeight: 700, fontSize: "0.72rem", height: 22 }}
                />

                {attemptCount > 0 && (
                  <Chip
                    size="small"
                    label={`${accuracy}% acc`}
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      height: 22,
                      bgcolor: accuracy >= 70 ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
                      color: accuracy >= 70 ? "#059669" : "#DC2626",
                    }}
                  />
                )}
              </Stack>
            </Box>

            <Stack direction="row" gap={0.75} alignItems="center">
              <Tooltip title={debugOpen ? "Hide debug" : "Debug"}>
                <IconButton
                  size="small"
                  onClick={() => setDebugOpen((v) => !v)}
                  sx={{ color: "text.secondary" }}
                >
                  <BugReportOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Button
                startIcon={<LogoutRoundedIcon />}
                variant="contained"
                size="small"
                onClick={() => navigate("/new-lessons")}
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
          </Stack>

          <Box sx={{ mt: 1.25 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 6,
                borderRadius: 999,
                bgcolor: "rgba(0,0,0,0.06)",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 999,
                  bgcolor: "#B43D20",
                  transition: "transform 0.5s ease",
                },
              }}
            />
          </Box>

          {debugOpen && (
            <Paper
              variant="outlined"
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 2,
                maxHeight: 200,
                overflow: "auto",
                fontFamily: "monospace",
                fontSize: 11,
                whiteSpace: "pre-wrap",
                bgcolor: "rgba(0,0,0,0.02)",
              }}
            >
              {JSON.stringify(debugInfo, null, 2)}
            </Paper>
          )}
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ pt: { xs: 2.5, md: 3.5 } }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: { xs: 3, md: 4 },
            border: "1px solid rgba(0,0,0,0.07)",
            bgcolor: "#FFFFFF",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: { xs: 2.5, md: 3.5 },
              pt: { xs: 2, md: 2.5 },
              pb: 1.5,
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography sx={{ fontSize: "1.3rem" }}>{stepIcon(activeKey)}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
                {activeLabel}
              </Typography>
            </Stack>

            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
              Step {step + 1} of {steps.length}
            </Typography>
          </Box>

          <Box
            sx={{
              minHeight: { xs: 400, md: 480 },
              px: { xs: 1.5, md: 3 },
              py: { xs: 2.5, md: 3 },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {steps[step] && (
              <Box key={`step-${step}-${attemptCount}`} sx={{ width: "100%" }}>
                {steps[step].comp(handleResult)}
              </Box>
            )}
          </Box>
        </Paper>
      </Container>

      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          bgcolor: "rgba(255,255,255,0.92)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Container maxWidth="md" sx={{ py: { xs: 1.5, md: 1.75 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
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

            <Stack direction="row" gap={1}>
              <Button
                onClick={handleSkip}
                variant="text"
                sx={{
                  minWidth: 80,
                  borderRadius: 999,
                  fontWeight: 700,
                  color: "text.secondary",
                }}
              >
                Skip
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
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default Lesson;