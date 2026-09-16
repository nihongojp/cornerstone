"use client";

import React from "react";
import { IconButton } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Link from "next/link";

const BRAND = "#B43D20";

const sideButtonSx = (side: "left" | "right") => ({
  position: "fixed",
  top: "50%",
  [side]: { xs: 4, sm: 12 },
  transform: "translateY(-50%)",
  zIndex: 2,
  width: { xs: 40, sm: 48 },
  height: { xs: 40, sm: 48 },
  bgcolor: "#fff",
  color: BRAND,
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  border: "1.5px solid rgba(180,61,32,0.25)",
  "&:hover": {
    bgcolor: "#fff",
    borderColor: BRAND,
    boxShadow: "0 6px 20px rgba(180,61,32,0.2)",
  },
});

export type ReviewNavArrowsProps = {
  prevHref?: string;
  nextHref?: string;
  prevLabel: string;
  nextLabel: string;
};

/**
 * Fixed chevrons on the left and right of a review page. A missing href
 * hides that side — the first and last lessons in a sequence have nowhere
 * to go, and a disabled control would look like a broken link.
 */
const ReviewNavArrows: React.FC<ReviewNavArrowsProps> = ({
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}) => (
  <>
    {prevHref && (
      <IconButton
        component={Link}
        href={prevHref}
        aria-label={prevLabel}
        sx={sideButtonSx("left")}
      >
        <ChevronLeftRoundedIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
      </IconButton>
    )}
    {nextHref && (
      <IconButton
        component={Link}
        href={nextHref}
        aria-label={nextLabel}
        sx={sideButtonSx("right")}
      >
        <ChevronRightRoundedIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
      </IconButton>
    )}
  </>
);

export default ReviewNavArrows;
