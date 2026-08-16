"use client";

import React from "react";
import MatchDotsMedia, { MediaMatchPair } from "./MatchDotsMedia";

interface Props {
  item: {
    instructions?: string;
    description?: string;
    items?: Array<{
      phrase: string;
      audioUrl?: string;
      imageUrl?: string;
    }>;
  };
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
}

const MatchingExercisePlaceholder: React.FC<Props> = ({ item, onResult }) => {
  const pairs: MediaMatchPair[] = (item.items || []).map((m) => ({
    phrase: m.phrase,
    audioUrl: m.audioUrl || "",
    imageUrl: m.imageUrl || "",
  }));

  return (
    <MatchDotsMedia
      pairs={pairs}
      instructions={item.instructions || item.description}
      onResult={onResult}
    />
  );
};

export default MatchingExercisePlaceholder;
