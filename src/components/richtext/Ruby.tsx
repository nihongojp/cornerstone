"use client";

import React from "react";
import { Box } from "@mui/material";

import type { RubySegment } from "../../lib/content/furigana";

/*
 * Furigana: a reading set above the characters it belongs to.
 *
 * ── `ruby-position` is set explicitly, and has to be ────────────────────────
 *
 * Browsers disagree on the default. `ruby-position: over` is what a Japanese
 * reader expects, and getting `under` instead does not look like a bug — it looks
 * like a design choice, in the one place where being wrong is a teaching error
 * rather than a cosmetic one. Both `-webkit-` and the standard property are set:
 * Safari still needs the prefix for `ruby-position` and ignores the unprefixed
 * one.
 *
 * `ruby-align: center` for the same reason — the unset default spreads the
 * reading across the base in some engines, which is legible but not how
 * textbooks set it.
 *
 * ── A segment with no reading is not an empty `<rt>` ────────────────────────
 *
 * 食べる is 食 with the reading た, then べる with none. An empty `<rt>` still
 * reserves the line above it, so the okurigana would sit lower than the kanji it
 * follows. Segments with no reading render as bare text instead, which is why
 * `renderableTerm` drops empty readings rather than passing them through.
 */
export const Ruby: React.FC<{ segments: RubySegment[] }> = ({ segments }) => (
  <Box
    component="ruby"
    sx={{
      rubyAlign: "center",
      WebkitRubyPosition: "over",
      rubyPosition: "over",
      // Ruby text is small; without this it inherits a line height tuned for
      // body copy and the reading crowds the character below it.
      lineHeight: 2,
      "& rt": { fontSize: "0.55em", letterSpacing: "0.02em", userSelect: "none" },
    }}
  >
    {segments.map((segment, index) => (
      // Position is the identity here — the same base can legitimately repeat
      // within one word, so there is no better key than the index.
      <React.Fragment key={index}>
        {segment.base}
        {segment.ruby !== undefined && <rt>{segment.ruby}</rt>}
      </React.Fragment>
    ))}
  </Box>
);

export default Ruby;
