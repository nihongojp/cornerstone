"use client";

import React, { useMemo, useState } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";

import RichText from "@/components/richtext/RichText";
import { dropdownChoices, gradeBlanks, splitLines } from "@/lib/content/fillInBlank";
import type { FillInBlankBlock } from "@/payload/payload-types";

const GREEN = "#059669";
const RED = "#DC2626";
// The same two speaker colours the dialogue screens use, in order of appearance.
const SPEAKER_COLORS = ["#B43D20", "#6366f1"] as const;

/*
 * A sentence with gaps: each gap is a dropdown or a text box, depending on the
 * block's `mode`.
 *
 * The sentence can be several lines — a short dialogue. Each line is its own row,
 * and a "Name (Role):" at the start of a line is shown as the speaker, the way the
 * dialogue screens show one. Inside a row the words and the gaps flow as one line
 * of text, so punctuation stays attached to the gap it follows.
 *
 * Checking marks every blank right or wrong on its own, so a learner with two of
 * three sees which two. The answers are not revealed on a miss — fixing the red
 * ones and checking again is the exercise; `explanation` is where an author says
 * why. Editing a blank clears the marks, the same as the drag-and-drop does.
 *
 * Check works on an incomplete sentence — an empty blank is simply wrong — rather
 * than sitting disabled with no hint as to why.
 */
export const FillInBlank: React.FC<
  FillInBlankBlock & { onResult?: (r: { result: "correct" | "incorrect"; detail?: unknown }) => void }
> = ({ instructions, mode, sentence, blanks, explanation, onResult }) => {
  const rows = blanks ?? [];
  const lines = useMemo(() => splitLines(sentence ?? ""), [sentence]);
  const hasSpeakers = lines.some((line) => line.speaker);
  const speakerOrder = useMemo(() => {
    const seen: string[] = [];
    for (const line of lines) if (line.speaker && !seen.includes(line.speaker)) seen.push(line.speaker);
    return seen;
  }, [lines]);

  const [given, setGiven] = useState<string[]>(() => rows.map(() => ""));
  const [checked, setChecked] = useState(false);

  // Seeded by the sentence and the blank's place, so server and browser agree and
  // a learner does not get a different order each time the screen re-renders.
  const choices = useMemo(
    () => rows.map((blank, i) => dropdownChoices(blank, `${sentence}|${i}`)),
    [rows, sentence]
  );

  const verdicts = useMemo(() => gradeBlanks(given, rows), [given, rows]);
  const allCorrect = verdicts.length > 0 && verdicts.every(Boolean);

  const change = (index: number, value: string) => {
    setChecked(false);
    setGiven((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const check = () => {
    setChecked(true);
    onResult?.({
      result: allCorrect ? "correct" : "incorrect",
      detail: { given, expected: rows.map((b) => b.answer) },
    });
  };

  const reset = () => {
    setGiven(rows.map(() => ""));
    setChecked(false);
  };

  const outline = (index: number) => {
    if (!checked) return undefined;
    return verdicts[index] ? GREEN : RED;
  };

  const blankSx = (index: number) => ({
    "& .MuiOutlinedInput-root": {
      bgcolor: checked ? (verdicts[index] ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)") : "#fff",
      "& fieldset": {
        borderWidth: 2,
        borderColor: outline(index) ?? "rgba(0,0,0,0.2)",
      },
      "&:hover fieldset": { borderColor: outline(index) ?? "#B43D20" },
      "&.Mui-focused fieldset": { borderColor: outline(index) ?? "#B43D20" },
    },
  });

  const field = (index: number) => {
    const answerLength = rows[index]?.answer?.length ?? 4;

    return mode === "typed" ? (
      <TextField
        size="small"
        value={given[index] ?? ""}
        onChange={(e) => change(index, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") check();
        }}
        slotProps={{
          htmlInput: {
            "aria-label": `Blank ${index + 1}`,
            autoCapitalize: "none",
            autoCorrect: "off",
            autoComplete: "off",
            spellCheck: false,
            style: { textAlign: "center", fontSize: "1rem" },
          },
        }}
        // Wide enough for the answer plus a little, without being so tight it gives
        // the length away to the letter.
        sx={{ width: `${Math.min(Math.max(answerLength + 4, 8), 24)}ch`, ...blankSx(index) }}
      />
    ) : (
      <TextField
        select
        size="small"
        value={given[index] ?? ""}
        onChange={(e) => change(index, e.target.value)}
        slotProps={{
          select: { native: true },
          htmlInput: { "aria-label": `Blank ${index + 1}` },
        }}
        sx={{
          minWidth: 110,
          "& .MuiNativeSelect-select": { fontSize: "1rem" },
          ...blankSx(index),
        }}
      >
        <option value="">Choose…</option>
        {(choices[index] ?? []).map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </TextField>
    );
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 720, mx: "auto", px: { xs: 1, sm: 2 } }}>
      {instructions && (
        <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, mb: 2, color: "#1C1917" }}>
          {instructions}
        </Typography>
      )}

      <Box
        sx={{
          display: "grid",
          // Speaker names share one column, as wide as the longest, so every line
          // starts at the same edge; on a narrow screen the name sits above its line.
          gridTemplateColumns: hasSpeakers ? { xs: "1fr", sm: "max-content 1fr" } : "1fr",
          columnGap: 1.5,
          rowGap: 1.5,
          alignItems: "baseline",
          fontSize: { xs: "1.15rem", sm: "1.3rem" },
          lineHeight: 2.3,
          color: "#1C1917",
        }}
      >
        {lines.map((line, i) => (
          <Box
            key={i}
            sx={{
              display: "grid",
              gridColumn: "1 / -1",
              gridTemplateColumns: hasSpeakers ? { xs: "1fr", sm: "subgrid" } : "1fr",
              rowGap: { xs: 0, sm: 0 },
              alignItems: "baseline",
            }}
          >
            {hasSpeakers && (
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                  color: line.speaker
                    ? SPEAKER_COLORS[speakerOrder.indexOf(line.speaker) % SPEAKER_COLORS.length]
                    : "transparent",
                }}
              >
                {line.speaker ?? ""}
              </Typography>
            )}

            {/* Words and gaps in one run of text, so a gap and the punctuation
                right after it can never be split across two rows. */}
            <Box sx={{ minWidth: 0 }}>
              {line.parts.map((part, j) =>
                part.kind === "text" ? (
                  <Box key={j} component="span" sx={{ whiteSpace: "pre-wrap" }}>
                    {part.text}
                  </Box>
                ) : (
                  <Box
                    key={j}
                    component="span"
                    sx={{ display: "inline-block", verticalAlign: "middle", mx: 0.5 }}
                  >
                    {field(part.index)}
                  </Box>
                )
              )}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: 2.5, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
        <Button
          variant="contained"
          onClick={check}
          sx={{ borderRadius: 999, fontWeight: 700, bgcolor: "#B43D20", "&:hover": { bgcolor: "#9D351C" }, px: 3 }}
        >
          Check
        </Button>
        <Button
          variant="outlined"
          onClick={reset}
          sx={{ borderRadius: 999, fontWeight: 700, borderColor: "rgba(0,0,0,0.15)", color: "text.secondary" }}
        >
          Reset
        </Button>

        {checked && (
          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: allCorrect ? GREEN : RED }}>
            {allCorrect
              ? "✓ Correct!"
              : rows.length > 1
                ? `✗ ${verdicts.filter(Boolean).length} of ${rows.length} right — fix the red ones and check again.`
                : "✗ Not quite — try again."}
          </Typography>
        )}
      </Box>

      {checked && explanation && (
        <Box sx={{ mt: 2, color: "#374151", lineHeight: 1.7 }}>
          <RichText data={explanation} />
        </Box>
      )}
    </Box>
  );
};

export default FillInBlank;
