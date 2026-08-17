"use client";

import React from "react";
import { useRowLabel } from "@payloadcms/ui";

/*
 * What a collapsed block row says in the admin.
 *
 * Without this, a lesson of thirty-odd exercises is thirty rows reading "Prose",
 * "Prose", "Match pairs", and finding the screen you want means opening them one
 * at a time. Payload's default row label is the block's name; this puts the
 * block's *content* there instead — the first line of the copy, the pattern being
 * taught, the instructions.
 *
 * ── Why one component and not ten ────────────────────────────────────────────
 *
 * Every extra `admin.components.Label` is an entry in the generated import map,
 * and a stale import map is a class of failure this repo has already hit once
 * (`39f1e3f` had to fix one by hand). One component that switches on `blockType`
 * is one entry, and adding a block to the library needs no import-map change at
 * all — only a case here, in the same file, if the default is not good enough.
 *
 * Rich text is read as text rather than rendered: `useRowLabel` returns the raw
 * form data, so `content` is a Lexical document. Walking it for the first text
 * node is enough for a label and avoids pulling the whole converter into the
 * admin bundle for the sake of one line.
 */

type RowData = Record<string, unknown>;

export const BlockRowLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<RowData>();
  const index = String((rowNumber ?? 0) + 1).padStart(2, "0");
  const summary = summarise(data);

  return (
    <span>
      {index}
      {" — "}
      {summary}
    </span>
  );
};

/** The most identifying thing the block has, as one short line. */
function summarise(data: RowData | undefined): string {
  if (!data) return "…";
  const blockType = String(data.blockType ?? "");

  switch (blockType) {
    case "prose":
      return text(data.title) ?? firstText(data.content) ?? "Prose";
    case "videoLesson":
      return text(data.title) ?? "Video";
    case "grammarPoint": {
      const points = Array.isArray(data.points) ? data.points : [];
      const first = points[0] as RowData | undefined;
      return text(data.title) ?? text(first?.pattern) ?? "Grammar point";
    }
    case "vocabList":
      return (
        text(data.title) ??
        `${countOf(data.terms)} word${countOf(data.terms) === 1 ? "" : "s"}`
      );
    case "mediaFigure":
      return text(data.caption) ?? "Figure";
    case "matchPairs":
      return text(data.instructions) ?? `Match ${countOf(data.terms)} pairs`;
    case "listenAndChoose":
      return text(data.instructions) ?? "Listen and choose";
    case "buildSentence":
      return (
        text(data.instructions) ??
        (Array.isArray(data.correctSequence) ? data.correctSequence.join(" ") : "Build a sentence")
      );
    case "speakAndScore":
      return text(data.transcript) ?? "Speak and score";
    case "multipleChoice":
      return firstText(data.question) ?? "Multiple choice";
    default:
      // An old block. It still gets a numbered row, which is more than it had.
      return blockType || "Block";
  }
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

/** The first run of text in a Lexical document, for a one-line summary. */
function firstText(value: unknown): string | undefined {
  const found = findText(value);
  return found ? text(found) : undefined;
}

function findText(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const record = node as RowData;
  if (typeof record.text === "string" && record.text.trim()) return record.text;

  const children = record.children ?? (record.root as RowData | undefined)?.children;
  if (!Array.isArray(children)) return undefined;
  for (const child of children) {
    const found = findText(child);
    if (found) return found;
  }
  return undefined;
}

function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export default BlockRowLabel;
