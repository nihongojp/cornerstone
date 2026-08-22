"use client";

import React, { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import type { MultipleChoiceBlock } from "@/payload/payload-types";

import RichText from "@/components/richtext/RichText";

/*
 * A question with one right answer.
 *
 * New in Phase 4a — the plan's note was "you'll want it within a week of
 * authoring", and there was genuinely no way to ask a learner a question that
 * was not either a matching exercise or a drag-and-drop.
 *
 * Which option is correct comes from `isCorrect` on the option, not from its
 * position, so the options can be reordered in the admin without silently
 * changing the answer. Exactly one is enforced by the block's own `validate`.
 *
 * Order is stable rather than shuffled: the seeded shuffle keyed on
 * `userId + lessonId + attempt` arrives in Phase 4b, and shuffling here with
 * `Math.random` would reintroduce exactly the hydration mismatch that forced the
 * old expander into a `useEffect`.
 */
export const MultipleChoice: React.FC<
  MultipleChoiceBlock & { onResult?: (r: { result: "correct" | "incorrect" }) => void }
> = ({ question, options, explanation, onResult }) => {
  const [chosen, setChosen] = useState<string | null>(null);
  const list = options ?? [];
  const answered = chosen !== null;

  const choose = (id: string, isCorrect: boolean) => {
    if (answered) return;
    setChosen(id);
    onResult?.({ result: isCorrect ? "correct" : "incorrect" });
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
      <Box sx={{ mb: 2, fontSize: { xs: "1.05rem", sm: "1.15rem" }, lineHeight: 1.6 }}>
        <RichText data={question} />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {list.map((option, index) => {
          const id = option.id ?? String(index);
          const isCorrect = option.isCorrect === true;
          const picked = chosen === id;
          // After answering, the right answer is always marked — being shown
          // which one it was is the point of getting it wrong.
          const reveal = answered && (picked || isCorrect);

          return (
            <Button
              key={id}
              onClick={() => choose(id, isCorrect)}
              disabled={answered}
              disableRipple={answered}
              startIcon={
                reveal ? isCorrect ? <CheckRoundedIcon /> : <CloseRoundedIcon /> : undefined
              }
              sx={{
                justifyContent: "flex-start",
                textAlign: "left",
                textTransform: "none",
                fontSize: "1rem",
                fontWeight: 600,
                px: 2,
                py: 1.25,
                borderRadius: "14px",
                border: "1px solid",
                borderColor: reveal
                  ? isCorrect
                    ? "#15803D"
                    : "#B91C1C"
                  : "rgba(0,0,0,0.12)",
                bgcolor: reveal
                  ? isCorrect
                    ? "rgba(21,128,61,0.08)"
                    : "rgba(185,28,28,0.08)"
                  : "#FFFFFF",
                color: reveal ? (isCorrect ? "#15803D" : "#B91C1C") : "#1C1917",
                // Disabled buttons inherit a grey that hides the mark above.
                "&.Mui-disabled": {
                  color: reveal ? (isCorrect ? "#15803D" : "#B91C1C") : "#57534E",
                },
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </Box>

      {answered && explanation && (
        <Box sx={{ mt: 2, color: "#374151", lineHeight: 1.7 }}>
          <RichText data={explanation} />
        </Box>
      )}

      {answered && !explanation && (
        <Typography sx={{ mt: 2, color: "text.secondary", fontSize: "0.9rem" }}>
          {list.some((o) => o.id === chosen && o.isCorrect) ? "Correct." : "Not this time."}
        </Typography>
      )}
    </Box>
  );
};

export default MultipleChoice;
