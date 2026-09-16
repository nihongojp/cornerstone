"use client";

import React from "react";
import { Box, IconButton } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Link from "next/link";

const BRAND = "#B43D20";

const cornerButtonSx = {
  width: 40,
  height: 40,
  bgcolor: "#fff",
  color: BRAND,
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  border: "1.5px solid rgba(180,61,32,0.25)",
  "&:hover": {
    bgcolor: "#fff",
    borderColor: BRAND,
    boxShadow: "0 4px 14px rgba(180,61,32,0.18)",
  },
};

export type ReviewNavArrowsProps = {
  prevHref?: string;
  nextHref?: string;
  prevLabel: string;
  nextLabel: string;
};

/**
 * Prev/next chevrons pinned to the top-left and top-right corners of the
 * review page. A missing href leaves that corner empty — the first and last
 * lessons in a sequence have nowhere to go, and a disabled control would look
 * like a broken link.
 */
const ReviewNavArrows: React.FC<ReviewNavArrowsProps> = ({
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}) => (
  <Box
    sx={{
      position: "sticky",
      top: 0,
      zIndex: 2,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      px: { xs: 1.5, sm: 2 },
      py: 1.5,
      bgcolor: "#F9F7F4",
      // Keep the sticky bar from sitting on top of scrolled term cards.
      borderBottom: "1px solid rgba(0,0,0,0.06)",
    }}
  >
    <Box sx={{ width: 40, height: 40, displayShrink: 0 }}>
      {prevHref ? (
        <IconButton
          component={Link}
          href={prevHref}
          aria-label={prevLabel}
          sx={cornerButtonSx}
        >
          <ChevronLeftRoundedIcon sx={{ fontSize: 28 }} />
        </IconButton>
      ) : null}
    </Box>
    <Box sx={{ width: 40, height: 40, flexShrink: 0 }}>
      {nextHref ? (
        <IconButton
          component={Link}
          href={nextHref}
          aria-label={nextLabel}
          sx={cornerButtonSx}
        >
          <ChevronRightRoundedIcon sx={{ fontSize: 28 }} />
        </IconButton>
      ) : null}
    </Box>
  </Box>
);

export default ReviewNavArrows;
