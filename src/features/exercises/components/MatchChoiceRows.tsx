"use client";

import React, { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import { buildChoiceOptions, type ChoiceCandidate } from "@/utils/buildChoiceOptions";

const BRAND = "#B43D20";

export type ChoiceRowPair = { prompt: string; answer: string };

type Props = {
  pairs: ChoiceRowPair[];
  heading?: string;
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
};

/*
 * One prompt, three boxed choices per row — the same "pick the matching one"
 * layout MatchAudioExercisePlaceholder uses for situation-to-audio (three
 * square boxes, tap to pick, check-mark/cross reveal), reused here for a
 * text prompt and text choices (a reading, matched to its hiragana) instead
 * of images. DotMatch's connect-the-dots interaction does not read as "the
 * same design" as the other choose-the-right-option exercises, which is the
 * whole point of this component.
 *
 * Every pair is shown at once, with one shared Check — consistent with the
 * rest of `matchPairs` (DotMatch grades the whole set in one pass too),
 * rather than stepping through pairs one at a time the way a standalone
 * `listenAndChoose` block does.
 */
const MatchChoiceRows: React.FC<Props> = ({ pairs, heading, onResult }) => {
  // Each row's 3 choices (its own answer + 2 distinct distractors from the
  // other pairs' answers) are computed once per mount, same lazy-init
  // pattern as MatchAudioExercisePlaceholder — fresh on every attempt, stable
  // for the duration of this one.
  const [choicesByRow] = useState<ChoiceCandidate[][]>(() =>
    pairs.map((pair, i) => {
      const pool: ChoiceCandidate[] = pairs
        .filter((_, j) => j !== i)
        .map((p) => ({ phrase: p.answer }));
      return buildChoiceOptions({ phrase: pair.answer }, pool, 2);
    })
  );
  const [selected, setSelected] = useState<(string | null)[]>(() => pairs.map(() => null));
  const [checked, setChecked] = useState(false);

  const choose = (row: number, phrase: string) => {
    if (checked) return;
    setSelected((prev) => {
      const next = [...prev];
      next[row] = phrase;
      return next;
    });
  };

  const canCheck = selected.every((s) => s !== null) && pairs.length > 0;
  const allCorrect = selected.every((s, i) => s === pairs[i]?.answer);

  const handleCheck = () => {
    setChecked(true);
    onResult?.({
      result: allCorrect ? "correct" : "incorrect",
      detail: { selected, expected: pairs.map((p) => p.answer) },
    });
  };

  const handleReset = () => {
    setSelected(pairs.map(() => null));
    setChecked(false);
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 560,
        mx: "auto",
        px: { xs: 1, sm: 2 },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, textAlign: "center", color: "#1C1917" }}>
        {heading ?? "Match each reading to its hiragana"}
      </Typography>

      {pairs.map((pair, row) => (
        <Box key={row} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, width: "100%" }}>
          <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "#1C1917" }}>{pair.prompt}</Typography>

          <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, width: "100%", justifyContent: "center" }}>
            {choicesByRow[row].map((choice, i) => {
              const picked = selected[row] === choice.phrase;
              const isAnswer = choice.phrase === pair.answer;
              const reveal = checked && (picked || isAnswer);
              const state = reveal ? (isAnswer ? "correct" : "wrong") : "idle";

              return (
                <Box
                  key={i}
                  onClick={() => choose(row, choice.phrase)}
                  sx={{
                    flex: 1,
                    maxWidth: 150,
                    aspectRatio: "1",
                    borderRadius: "16px",
                    border: `3px solid ${
                      state === "correct" ? "#059669"
                      : state === "wrong" ? "#DC2626"
                      : picked ? BRAND
                      : "rgba(0,0,0,0.1)"
                    }`,
                    bgcolor:
                      state === "correct" ? "rgba(5,150,105,0.06)"
                      : state === "wrong" ? "rgba(220,38,38,0.06)"
                      : picked ? "rgba(180,61,32,0.05)"
                      : "#FAFAFA",
                    cursor: checked ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                    transition: "border-color 0.2s, background-color 0.2s, transform 0.15s",
                    "&:hover": checked ? {} : {
                      borderColor: BRAND,
                      transform: "translateY(-2px)",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    },
                  }}
                >
                  <Typography sx={{ fontSize: { xs: "1.5rem", sm: "1.8rem" }, fontWeight: 700 }}>
                    {choice.phrase}
                  </Typography>

                  {reveal && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: isAnswer ? "rgba(5,150,105,0.15)" : "rgba(220,38,38,0.15)",
                        borderRadius: "13px",
                      }}
                    >
                      {isAnswer
                        ? <CheckRoundedIcon sx={{ fontSize: "2.5rem", color: "#059669" }} />
                        : <CloseRoundedIcon sx={{ fontSize: "2.5rem", color: "#DC2626" }} />}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}

      <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center" }}>
        <Button
          variant="contained"
          disabled={!canCheck || checked}
          onClick={handleCheck}
          sx={{ borderRadius: 999, fontWeight: 700, bgcolor: "#B43D20", "&:hover": { bgcolor: "#9D351C" }, px: 3 }}
        >
          Check
        </Button>
        <Button
          variant="outlined"
          onClick={handleReset}
          sx={{ borderRadius: 999, fontWeight: 700, borderColor: "rgba(0,0,0,0.15)", color: "text.secondary" }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  );
};

export default MatchChoiceRows;
