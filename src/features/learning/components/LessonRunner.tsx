"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { useRouter } from "next/navigation";

import Fact from "@/components/Fact";
import Reward from "@/components/Rewards";
import RewardInfo from "@/components/RewardInfo";
import RenderExercise from "@/features/exercises/components/RenderExercise";
import RichText from "@/components/richtext/RichText";

import { stepSeed, shuffleSteps } from "@/lib/content/shuffle";
import { PRACTICE_BLOCK_SLUGS } from "@/payload/blocks/librarySlugs";
import { upsertProgress } from "@/features/learning/actions";
import type { ProgressDoc } from "@/features/learning/types";
import type { Lesson } from "@/payload/payload-types";

/*
 * One player, for both lesson formats.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 *
 * `NewLessonPlayer` (453 lines) and `LessonPlayer` (1015) were one player each
 * for the two families of imported content, and most of both was a switch on
 * `item.type` reconstructing a screen from flattened fields — which fields were
 * present decided which component ran. Both are gone: a screen is an ordered
 * list of blocks, `features/exercises/components/RenderExercise` renders it from the
 * generated `Lesson` type, and what is left here is the shell around it.
 *
 * The two formats differ in nothing this file can see. `format` still decides
 * which URL a lesson plays at, because the two lists and the dashboard link by
 * it, but the runner is the same either way.
 *
 * ── Three things the old players generated, and no longer do ────────────────
 *
 *  - **Stroke-order screens.** `LessonPlayer` built one per character from
 *    `data/kanaStrokeOrder.ts`, a hardcoded table. They are authored exercises
 *    now (`vocabList` with `layout: "spotlight"`), so an author can see them.
 *  - **The practice batches.** `expandLessonItems` generated them at render
 *    time, shuffling with `Math.random` and then hiding the resulting hydration
 *    mismatch inside a `useEffect` — which is why every lesson used to paint a
 *    spinner first. The batches are authored rows; the ordering is a seeded,
 *    SSR-stable shuffle (`lib/content/shuffle.ts`).
 *  - **"Bonus fact coming soon."** A hardcoded placeholder screen appended to
 *    every flashcard lesson. Deleted rather than carried across: it is the same
 *    category as the PLACEHOLDER strings this phase took off the site.
 *
 * `funFact`, `notes` and `achievement` are still lesson-level fields rather than
 * blocks, so they are still rendered here — as trailing screens. `funFact` used
 * to sit after the flashcard deck; at the end is where a fact about the lesson
 * reads, and "after the deck" was a position no one chose.
 */

/** One authored row of `lesson.steps`. */
type AuthoredStep = NonNullable<Lesson["steps"]>[number];

const PRACTICE = new Set<string>(PRACTICE_BLOCK_SLUGS);

/** A screen to play: one authored step, or one of the lesson's own trailing screens. */
type Step = {
  /*
   * What progress is keyed on. For an authored step it is the array row's Payload id
   * — stable across edits, and the whole reason 4b re-keys `user_progress`. The
   * content-derived keys it replaces (`stepKeyForItem`, `stepKeyFromExercise`)
   * could not key a composite screen at all, and changed whenever the copy did.
   *
   * The lesson-level screens have no row of their own, so they take a literal.
   * That is not a hash of anything and cannot collide with a row id.
   */
  key: string;
  label: string;
  graded: boolean;
  /*
   * Whether getting it right moves on by itself. False for `buildSentence`: a
   * correct answer reveals the reference audio in place, and sweeping the
   * learner along a second later takes it away before they can play it. Both old
   * players had this rule, keyed off different field names.
   */
  autoAdvance: boolean;
  render: (onResult: (r: { result: "correct" | "incorrect" }) => void) => React.ReactNode;
};

function blockTypes(step: AuthoredStep): string[] {
  return (step.components ?? []).map((block) => block.blockType);
}

function buildSteps(lesson: Lesson, seed: string): Step[] {
  const authored = shuffleSteps(lesson.steps ?? [], {
    seed,
    // The field has existed since the import and nothing has ever read it.
    // Defaulting to true matches the collection's own default.
    enabled: lesson.shuffleSteps !== false,
  });

  const steps: Step[] = authored.map((step, index) => {
    const types = blockTypes(step);
    return {
      // Payload assigns the row id on save. Live Preview streams rows the editor
      // has only just added, which have none yet — the index keeps those
      // renderable rather than collapsing every unsaved screen onto one key.
      key: step.id ?? `unsaved:${index}`,
      label: step.label?.trim() || "Step",
      graded: types.some((type) => PRACTICE.has(type)),
      autoAdvance: !types.includes("buildSentence"),
      render: (onResult) => (
        <RenderExercise blocks={step.components ?? []} onResult={onResult} />
      ),
    };
  });

  const chrome = (key: string, label: string, node: React.ReactNode): Step => ({
    key,
    label,
    graded: false,
    autoAdvance: true,
    render: () => node,
  });

  if (lesson.funFact) {
    steps.push(
      chrome("lesson:funFact", "Fun Fact", (
        <Fact title="Fun Fact" description={<RichText data={lesson.funFact} />} />
      ))
    );
  }

  const achievement = lesson.achievement;
  if (achievement && (achievement.title || achievement.xp !== null)) {
    steps.push(
      chrome("lesson:achievement", "Reward", (
        <Reward title={achievement.title || "Lesson Complete!"} xp={achievement.xp ?? 0} />
      ))
    );
  }

  if (lesson.notes) {
    steps.push(
      chrome("lesson:notes", "Notes", (
        <RewardInfo title="Notes" description={<RichText data={lesson.notes} />} />
      ))
    );
  }

  return steps;
}

const LessonRunner: React.FC<{
  lesson: Lesson;
  /**
   * Where "Continue" goes — the next lesson in course order, resolved
   * server-side and already a href. A slug would not be enough: the two formats
   * play on different paths, and the step player used to hardcode `/newlesson/`.
   */
  nextHref?: string;
  /**
   * The signed-in learner, for the shuffle seed. Resolved on the server and
   * passed down rather than fetched: the seed has to be the same value during
   * SSR and during hydration, and anything fetched in the browser is not.
   * Absent for a signed-out learner, who gets a stable shared order.
   */
  userId?: string;
  /** How many times this learner has finished this lesson. Also server-side. */
  attempt?: number;
  /** Resume cursor, fetched on the server. Absent in Live Preview. */
  initialProgress?: ProgressDoc | null;
}> = ({ lesson, nextHref, userId, attempt = 0, initialProgress = null }) => {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);

  const answeredRef = useRef<Record<string, boolean>>({});
  const resumedRef = useRef(false);

  const slug = lesson.slug;

  const steps = useMemo(
    () => buildSteps(lesson, stepSeed({ userId, lessonId: slug, attempt })),
    [lesson, userId, slug, attempt]
  );

  /*
   * Position resets on the lesson's *identity*, not on the object it arrived in.
   * In the CMS preview panel this component is handed a freshly built lesson on
   * every keystroke, and resetting on object identity would throw the editor
   * back to step 1 each time they typed a character.
   */
  useEffect(() => {
    resumedRef.current = false;
    setStep(0);
    setCorrectCount(0);
    setAttemptCount(0);
    answeredRef.current = {};
  }, [slug]);

  // The list shrinks when an editor deletes an exercise mid-preview. Keep the
  // cursor inside it rather than rendering a blank step.
  useEffect(() => {
    if (steps.length && step >= steps.length) setStep(steps.length - 1);
  }, [steps, step]);

  // Lock page scroll for the whole lesson so Check/Reset stay in view.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /*
   * Resume where they left off.
   *
   * By key rather than by index, because the shuffle can put a different
   * exercise at the same position for the next attempt. The saved key is a
   * Payload row id now, so it identifies the same screen even after the copy on
   * it has been edited — which the content-derived keys could not.
   */
  useEffect(() => {
    if (!slug || !steps.length || resumedRef.current) return;
    resumedRef.current = true;

    const saved = initialProgress;
    if (!saved || saved.status !== "in_progress") return;
    const index = saved.stepKey ? steps.findIndex((s) => s.key === saved.stepKey) : -1;
    if (index >= 0) setStep(index);
    else if (saved.lastStep > 0 && saved.lastStep < steps.length) setStep(saved.lastStep);
  }, [slug, steps, initialProgress]);

  const total = steps.length;
  const active = steps[step];
  const isLast = step >= total - 1;
  const pct = total ? Math.round(((step + 1) / total) * 100) : 0;
  const accuracy = attemptCount ? Math.round((100 * correctCount) / attemptCount) : 0;

  /*
   * Progress writes are best-effort and always caught. In the CMS preview panel
   * there is no learner session at all, so every one of these 401s — unhandled,
   * that is an unhandled rejection per screen turned.
   */
  function save(status: "in_progress" | "completed", index: number, accuracyPct: number) {
    if (!slug || !steps[index]) return;
    void upsertProgress({
      lessonId: slug,
      status,
      lastStep: index,
      stepKey: steps[index].key,
      accuracyPct,
    }).catch((e) => console.error("[Progress] save failed:", e));
  }

  /** Records an attempt at most once per screen, returning the resulting accuracy. */
  function record(result: "correct" | "incorrect", graded: boolean, key: string): number {
    if (answeredRef.current[key]) return accuracy;
    answeredRef.current[key] = true;

    const attempts = attemptCount + (graded ? 1 : 0);
    const corrects = graded && result === "correct" ? correctCount + 1 : correctCount;
    setAttemptCount(attempts);
    setCorrectCount(corrects);

    return attempts ? Math.round((100 * corrects) / attempts) : accuracy;
  }

  function advance(accuracyPct: number) {
    if (isLast) {
      save("completed", step, accuracyPct);
      router.push(nextHref ?? "/lessons");
      return;
    }
    const next = step + 1;
    setStep(next);
    save("in_progress", next, accuracyPct);
  }

  const handleResult = ({ result }: { result: "correct" | "incorrect" }) => {
    if (!active) return;

    if (result !== "correct") {
      // A wrong answer counts against accuracy but does not move on — the
      // learner stays on the screen and tries again.
      setAttemptCount((c) => c + 1);
      return;
    }

    const next = record("correct", active.graded, active.key);
    if (active.autoAdvance) setTimeout(() => advance(next), 900);
  };

  const handleNext = () => {
    if (!active) return;
    advance(record(active.graded ? "incorrect" : "correct", active.graded, active.key));
  };

  const handleSkip = () => {
    if (!active) return;
    advance(record("incorrect", active.graded, active.key));
  };

  const handleBack = () => {
    const previous = Math.max(0, step - 1);
    // Let them answer it again — otherwise going back and retrying records
    // nothing, which reads as a broken screen.
    const key = steps[previous]?.key;
    if (key) delete answeredRef.current[key];
    setStep(previous);
  };

  const handleSaveAndExit = () => {
    save("in_progress", step, accuracy);
    router.push("/lessons");
  };

  if (!total) {
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
            onClick={() => router.push("/dashboard")}
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
      {/* ── Sticky header ───────────────────────────────────────────────── */}
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
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "0.95rem", sm: "1.05rem" },
                  letterSpacing: "-0.01em",
                }}
              >
                {lesson.cardTitle?.trim() || lesson.title}
              </Typography>
            </Box>

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
              Save &amp; Exit
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
                "& .MuiLinearProgress-bar": {
                  borderRadius: 999,
                  bgcolor: "#B43D20",
                  transition: "transform 0.5s ease",
                },
              }}
            />
          </Box>
        </Container>
      </Box>

      {/* ── The screen ──────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
              <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", letterSpacing: "-0.01em" }}>
                {active?.label}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                Step {step + 1} of {total}
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                px: { xs: 1, md: 2 },
                py: { xs: 1, md: 1.5 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {active && (
                <Box key={`step-${step}`} sx={{ width: "100%" }}>
                  {active.render(handleResult)}
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* ── Bottom nav ──────────────────────────────────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          bgcolor: "rgba(255,255,255,0.92)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Container maxWidth="md" sx={{ py: { xs: 1.25, md: 1.5 } }}>
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
              {/* Only a graded screen can be skipped — "skip" on a page of prose
                  is what Next already does. */}
              {active?.graded && (
                <Button
                  onClick={handleSkip}
                  variant="text"
                  sx={{ minWidth: 80, borderRadius: 999, fontWeight: 700, color: "text.secondary" }}
                >
                  Skip
                </Button>
              )}

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
                {isLast ? (nextHref ? "Continue →" : "Finish 🎉") : "Next →"}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default LessonRunner;
