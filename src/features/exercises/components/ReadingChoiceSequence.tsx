"use client";

import React, { useEffect, useRef, useState } from "react";

import MatchAudioExercisePlaceholder from "./MatchAudioExercisePlaceholder";

export type ReadingChoiceItem = {
  /** What the learner is shown: the romaji reading. */
  prompt: string;
  /** What they pick: the written character or word. */
  answer: string;
};

type Props = {
  items: ReadingChoiceItem[];
  onResult?: (r: { result: "correct" | "incorrect"; detail?: unknown }) => void;
};

// How long a right answer stays on screen, ticked, before the next word — the
// same pause the lesson player leaves before it moves on.
const NEXT_DELAY_MS = 900;

/*
 * Romaji ↔ hiragana as a run of Part 1's "listen and choose the character" screens:
 * one word at a time, three big boxes in a row, and a tick or a cross the moment one
 * is tapped — without the audio button, which would give the answer away. It is
 * the same component, so the two can never drift apart.
 *
 * The block is one lesson step, though, and the player treats the first "correct"
 * it hears as the step being finished and moves on. So a wrong tap is passed up
 * straight away — it counts against accuracy, exactly as in Part 1 — but "correct"
 * is held back until the last word, and between words this advances on its own.
 */
const ReadingChoiceSequence: React.FC<Props> = ({ items, onResult }) => {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const item = items[index];
  if (!item) return null;

  const isLast = index === items.length - 1;

  return (
    <MatchAudioExercisePlaceholder
      // A fresh exercise per word, so its choices and its ticked state start clean.
      key={index}
      item={{
        phrase: item.answer,
        answerWith: "text",
        // The romaji is on screen and the character is the answer, so no sound.
        hideAudio: true,
        prompt: `Choose the hiragana for “${item.prompt}”`,
        // The other words' answers are where the wrong boxes come from.
        checkpointPool: items.filter((_, i) => i !== index).map((other) => ({ phrase: other.answer })),
      }}
      onResult={(result) => {
        if (result.result === "incorrect" || isLast) {
          onResult?.(result);
          return;
        }
        timer.current = setTimeout(() => setIndex((i) => i + 1), NEXT_DELAY_MS);
      }}
    />
  );
};

export default ReadingChoiceSequence;
