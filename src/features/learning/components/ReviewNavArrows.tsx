"use client";

import React from "react";
import { IconButton } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Link from "next/link";

const BRAND = "#B43D20";

// Fixed to the middle of the screen's height, so they stay put and centred
// while a long page of cards scrolls under them. The review pages leave
// matching side padding on narrow screens so the arrows do not sit on content.
const edgeButtonSx = (side: "left" | "right") => ({
  position: "fixed",
  top: "50%",
  transform: "translateY(-50%)",
  [side]: { xs: 6, sm: 12 },
  zIndex: 2,
  width: { xs: 36, sm: 44 },
  height: { xs: 36, sm: 44 },
  bgcolor: "#fff",
  color: BRAND,
  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
  border: "1.5px solid rgba(180,61,32,0.3)",
  "&:hover": {
    bgcolor: "#fff",
    borderColor: BRAND,
    boxShadow: "0 4px 14px rgba(180,61,32,0.2)",
  },
});

export type ReviewNavArrowsProps = {
  prevHref?: string;
  nextHref?: string;
  prevLabel: string;
  nextLabel: string;
};

/**
 * Prev/next chevrons at the left and right edges, centred vertically, of a
 * review page. A missing href leaves that edge empty — the first and last
 * lessons have nowhere to go.
 */
const ReviewNavArrows: React.FC<ReviewNavArrowsProps> = ({
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}) => (
  <>
    {prevHref ? (
      <IconButton component={Link} href={prevHref} aria-label={prevLabel} sx={edgeButtonSx("left")}>
        <ChevronLeftRoundedIcon sx={{ fontSize: 30 }} />
      </IconButton>
    ) : null}
    {nextHref ? (
      <IconButton component={Link} href={nextHref} aria-label={nextLabel} sx={edgeButtonSx("right")}>
        <ChevronRightRoundedIcon sx={{ fontSize: 30 }} />
      </IconButton>
    ) : null}
  </>
);

export default ReviewNavArrows;
