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

import { submitAttempt, upsertProgress, getProgress } from "../services/progress";
import { isAuthed, safe } from "../services/api";
import { getLesson, LessonDoc } from "../services/lessons";
import { kanaTilesToRomaji } from "../utils/kana";

type ResultCb = (args: { result: "correct" | "incorrect"; detail?: any }) => void;
type StepSpec = {
  key: string;
  graded: boolean;
  // Defaults to true. Drag-and-drop sets this to false since its audio
  // button only appears after a correct check — auto-advancing would skip
  // past it before the learner gets a chance to click it.
  autoAdvance?: boolean;
  comp: (on: ResultCb) => React.ReactNode;
};

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
  answerCaption?: string;
  showAudioUpfront?: boolean;
}

export type DotMatchPair = { hiragana: string; katakana: string; audio?: string };

interface DotMatchProps {
  onResult?: ResultCb;
  pairs: DotMatchPair[];
  keepLeftOrder?: boolean;
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
  return {
    hiragana: (hiragana ?? s).trim(),
    katakana: (katakana ?? "").trim(),
  };
}

// Maps each flashcard's hiragana face to its per-character audio, so the
// same clip used on the flashcard can also play from Connect the Dots.
// Prefers the parallel flashcardsAudio[] array; falls back to matching
// matchAudioLetter exercise audio by correct answer (covers V2/V3 lessons
// that never authored flashcardsAudio in Mongo).
function buildCharAudioMap(lesson: any): Record<string, string> {
  const flashcards: string[] = lesson?.flashcards || [];
  const audio: string[] = lesson?.flashcardsAudio || [];
  const map: Record<string, string> = {};

  flashcards.forEach((raw, idx) => {
    const src = String(audio[idx] || "").trim();
    if (!src) return;
    const hiragana = String(raw).split("/")[0]?.trim();
    if (hiragana) map[hiragana] = src;
  });

  const exercises: any[] = lesson?.exercises || [];
  for (const ex of exercises) {
    if (String(ex?.type || "") !== "matchAudioLetter") continue;
    const src = String(ex?.audioUrl || ex?.audio || "").trim();
    if (!src) continue;
    const answers: string[] = Array.isArray(ex?.correctAnswers) ? ex.correctAnswers : [];
    for (const ans of answers) {
      const hiragana = String(ans).split("/")[0]?.trim();
      if (hiragana && !map[hiragana]) map[hiragana] = src;
    }
  }

  return map;
}

function resolveFlashcardAudio(
  raw: string,
  idx: number,
  flashcardsAudio: string[],
  charAudio: Record<string, string>
): string | undefined {
  const fromArray = String(flashcardsAudio[idx] || "").trim();
  if (fromArray) return fromArray;
  const hiragana = String(raw).split("/")[0]?.trim();
  const fromMap = hiragana ? String(charAudio[hiragana] || "").trim() : "";
  return fromMap || undefined;
}

// Fisher-Yates — used to randomize the order same-type exercises are
// presented in, without touching where that group sits relative to others.
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
  const cardTitle = String((lesson as any).cardTitle || "").trim();
  if (cardTitle) return cardTitle;
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
  if (key === "bonusFact") return "Bonus Fact";
  if (key === "reward") return "Reward";
  if (key === "rinfo") return "Notes";
  if (key.includes("connectTheDots")) return "Connect Dots";
  if (key.includes("matchAudioLetter")) return "Audio Match";
  if (key.includes("vocabulary_drag_drop")) return "Drag & Drop";
  return "Exercise";
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
  const resumedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    resumedRef.current = false;

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
          flashcardsAudioLen: ((l as any)?.flashcardsAudio || []).length,
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
    const flashcardsAudio: string[] = (lesson as any).flashcardsAudio || [];
    const charAudio = buildCharAudioMap(lesson);
    // Version 1 differs from version 2+ in a couple of ways: the under-image
    // answer caption on drag-and-drop is version-2+ only (v1 relies on its
    // audio hint instead), and Connect the Dots keeps its left column in
    // authored order instead of shuffling it too.
    const isV1 = String((lesson as any).version || "").trim().toUpperCase() === "V1";

    if (flashcards.length) {
      out.push({
        key: "flips",
        graded: true,
        comp: (on) => {
          const cardData: CardData[] = flashcards.map((raw, idx) => ({
            id: idx,
            front: raw,
            back: "",
            audio: resolveFlashcardAudio(raw, idx, flashcardsAudio, charAudio),
          }));

          return <FlipsC onResult={on} prompt="Flip each card to review." cards={cardData} />;
        },
      });
    }

    // Fun fact sits right after the flashcards and before any exercises
    // (e.g. Connect the Dots), rather than at the end of the lesson.
    if ((lesson as any).funFact) {
      out.push({
        key: "fact",
        graded: false,
        comp: () => <FactC title="Fun Fact" description={String((lesson as any).funFact || "")} />,
      });
    }

    const exercises: any[] = (lesson as any).exercises || [];

    // Randomize the order the audio-match exercises are presented in on each
    // load, without disturbing where that group sits relative to the other
    // exercise types.
    const shuffledAudioMatches = shuffle(exercises.filter((ex) => ex?.type === "matchAudioLetter"));
    let audioMatchCursor = 0;

    // Drag-and-drop has two independent batches — the main set and a bonus
    // repeat of the same terms — each shuffled on its own so neither batch
    // always presents its terms in the same order.
    const shuffledMainDrag = shuffle(
      exercises.filter((ex) => ex?.type === "vocabulary_drag_drop" && !ex?.bonus)
    );
    const shuffledBonusDrag = shuffle(
      exercises.filter((ex) => ex?.type === "vocabulary_drag_drop" && ex?.bonus)
    );
    let mainDragCursor = 0;
    let bonusDragCursor = 0;

    exercises.forEach((ex, i) => {
      const exType = String(ex?.type || "");

      if (exType === "connectTheDots") {
        const key = stepKeyFromExercise(ex, i);
        const pairs: DotMatchPair[] = (ex.items || []).map((s: string) => {
          const pair = splitPair(s);
          return { ...pair, audio: charAudio[pair.hiragana] || undefined };
        });
        out.push({
          key,
          graded: true,
          comp: (on) => <DotsC onResult={on} pairs={pairs} keepLeftOrder={isV1} />,
        });
        return;
      }

      if (exType === "matchAudioLetter") {
        const shuffledEx = shuffledAudioMatches[audioMatchCursor++];
        const key = stepKeyFromExercise(shuffledEx, i);

        // Keep the full "hiragana/katakana" pair on each choice (instead of
        // normalizing down to hiragana only) so both scripts are visible.
        const options = Array.from(new Set((shuffledEx.items || []) as string[]));
        const correctAnswer = (shuffledEx.correctAnswers || [])[0] || options[0] || "";

        out.push({
          key,
          graded: true,
          comp: (on) => (
            <AudioC
              onResult={on}
              options={options}
              correctAnswer={correctAnswer}
              audioUrl={shuffledEx.audioUrl || shuffledEx.audio}
              prompt={shuffledEx.prompt || "Listen and choose the right character"}
            />
          ),
        });
        return;
      }

      if (exType === "vocabulary_drag_drop") {
        const isBonus = !!ex.bonus;
        const shuffledEx = isBonus
          ? shuffledBonusDrag[bonusDragCursor++]
          : shuffledMainDrag[mainDragCursor++];
        const key = stepKeyFromExercise(shuffledEx, i);
        const rawBank: string[] = shuffledEx.characterBank || [];
        const rawAnswer: string[] = String(shuffledEx.correctAnswer || "").split("");

        // Version 2+'s main set already shows the correct Japanese word as a
        // caption hint, so it drags English letters (the romaji reading)
        // instead of hiragana tiles. The bonus set has no caption hint and
        // keeps building the hiragana spelling from scratch.
        const useRomajiTiles = !isV1 && !isBonus;

        out.push({
          key,
          graded: true,
          autoAdvance: false,
          comp: (on) => (
            <DragC
              onResult={on}
              prompt={
                shuffledEx.prompt ||
                (isBonus ? "Bonus: build the correct word without hints" : "Build the correct word")
              }
              characterBank={useRomajiTiles ? kanaTilesToRomaji(rawBank) : rawBank}
              correctAnswer={useRomajiTiles ? undefined : shuffledEx.correctAnswer}
              answer={useRomajiTiles ? kanaTilesToRomaji(rawAnswer) : undefined}
              audioUrl={shuffledEx.audioUrl}
              imageUrl={resolveExerciseImage(shuffledEx)}
              answerCaption={!isBonus && !isV1 ? shuffledEx.correctAnswer : undefined}
              showAudioUpfront={isV1}
            />
          ),
        });
        return;
      }

      console.warn("[Lesson] unknown exercise type:", exType, ex);
    });

    // Placeholder bonus fact after all exercises and before the reward /
    // "Lesson Complete!" page. Hardcoded for every lesson for now.
    out.push({
      key: "bonusFact",
      graded: false,
      comp: () => <FactC title="Bonus Fact" description="Bonus fact coming soon." />,
    });

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

  // Resume at the last-seen step, since exercise order here is authored and
  // stable (unlike the Grammar flow, no re-shuffling happens), so the saved
  // raw index is safe to reuse directly. Runs once per lesson load.
  useEffect(() => {
    if (!lesson || !isAuthed() || !lessonKey || !steps.length || resumedRef.current) return;
    resumedRef.current = true;

    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const saved = await getProgress(lessonKey);
        if (!cancelled && saved && saved.status === "in_progress" && saved.lastStep > 0 && saved.lastStep < steps.length) {
          setStep(saved.lastStep);
        }
      } catch (e) {
        console.error("[Progress] fetch failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [lesson, lessonKey, steps]);

  // Lock page scroll for the whole lesson so Check/Reset stay in view.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Records an attempt's outcome (counts + server sync) at most once per
  // step, returning the accuracy that resulted from it. Separated from
  // navigation so a correct drag-and-drop answer can be recorded right away
  // while still waiting on the learner to click "Next" before moving on.
  function recordAttempt({
    result,
    detail,
    createAttempt,
    stepKey,
  }: {
    result: "correct" | "incorrect";
    detail?: any;
    createAttempt: boolean;
    stepKey: string;
  }): number {
    if (answeredStepRef.current[stepKey]) return accuracy;

    answeredStepRef.current[stepKey] = true;

    const nextAttemptCount = attemptCount + (createAttempt ? 1 : 0);
    const nextCorrectCount = createAttempt && result === "correct" ? correctCount + 1 : correctCount;
    const nextAccuracy = nextAttemptCount ? Math.round((100 * nextCorrectCount) / nextAttemptCount) : accuracy;

    setAttemptCount(nextAttemptCount);
    setCorrectCount(nextCorrectCount);

    if (lesson && isAuthed() && createAttempt && lessonKey) {
      void submitAttempt({ lessonId: lessonKey, stepIndex: step, result, detail });
    }

    return nextAccuracy;
  }

  function goToNextStep(nextAccuracy: number) {
    const isLastStep = step >= steps.length - 1;

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

      navigate("/new-lessons");
    }
  }

  function advance(args: {
    result: "correct" | "incorrect";
    detail?: any;
    createAttempt: boolean;
    stepKey: string;
  }) {
    goToNextStep(recordAttempt(args));
  }

  const handleResult = (args: { result: "correct" | "incorrect"; detail?: any }) => {
    const k = steps[step]?.key || String(step);

    if (args.result === "correct") {
      const autoAdvance = steps[step]?.autoAdvance ?? true;

      if (autoAdvance) {
        setTimeout(() => {
          advance({ ...args, createAttempt: true, stepKey: k });
        }, 900);
      } else {
        recordAttempt({ ...args, createAttempt: true, stepKey: k });
      }
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

  const handleSaveAndExit = () => {
    if (lesson && isAuthed() && lessonKey) {
      void upsertProgress({
        lessonId: lessonKey,
        status: "in_progress",
        lastStep: step,
        stepKey: steps[step]?.key,
        accuracyPct: accuracy,
      }).catch((e) => console.error("[Progress] save failed:", e));
    }
    navigate("/new-lessons");
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
    <Box
      sx={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#F9F7F4",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          zIndex: 10,
          backdropFilter: "blur(12px)",
          bgcolor: "rgba(249,247,244,0.85)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}
      >
        <Container maxWidth="md" sx={{ py: 1 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Button
              startIcon={<ArrowBackRoundedIcon />}
              variant="text"
              onClick={() => navigate("/new-lessons")}
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
                  fontSize: { xs: "0.9rem", sm: "1rem" },
                  letterSpacing: "-0.01em",
                }}
              >
                {getLessonHeader(lesson)}
              </Typography>

              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mt: 0.15 }}>
                {attemptCount > 0 && (
                  <Chip
                    size="small"
                    label={`${accuracy}% acc`}
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      height: 20,
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
                onClick={handleSaveAndExit}
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

          <Box sx={{ mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 5,
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
                mt: 1,
                p: 1,
                borderRadius: 2,
                maxHeight: 120,
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

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            pt: { xs: 1, md: 1.5 },
            pb: { xs: 1, md: 1.5 },
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              borderRadius: { xs: 3, md: 4 },
              border: "1px solid rgba(0,0,0,0.07)",
              bgcolor: "#FFFFFF",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                flexShrink: 0,
                px: { xs: 2, md: 3 },
                py: 1,
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", letterSpacing: "-0.01em" }}>
                  {activeLabel}
                </Typography>
              </Stack>

              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                Step {step + 1} of {steps.length}
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                px: { xs: 1, md: 2 },
                py: { xs: 1, md: 1.5 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {steps[step] && (
                <Box
                  key={`step-${step}`}
                  sx={{ width: "100%", height: "100%", overflow: "hidden", display: "flex", alignItems: "center" }}
                >
                  {steps[step].comp(handleResult)}
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          bgcolor: "rgba(255,255,255,0.92)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Container maxWidth="md" sx={{ py: { xs: 1, md: 1.25 } }}>
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