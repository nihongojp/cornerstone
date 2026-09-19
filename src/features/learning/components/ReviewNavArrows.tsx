"use client";

import React, { useState } from "react";
import { IconButton } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Link from "next/link";
import { useRouter } from "next/navigation";

const BRAND = "#B43D20";

const cornerButtonSx = (side: "left" | "right") => ({
  position: "absolute",
  top: { xs: 8, sm: 12 },
  [side]: { xs: 8, sm: 12 },
  zIndex: 2,
  width: 44,
  height: 44,
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
  /**
   * When set (the player's final Review step), run this before leaving —
   * same reason `ReviewTermsButton` awaits completion: navigating away
   * without the write leaves the lesson "in progress".
   */
  beforeNavigate?: () => Promise<boolean>;
};

/**
 * Prev/next chevrons in the top-left and top-right corners of a review
 * surface. The parent must be `position: relative`. A missing href leaves
 * that corner empty — the first and last lessons have nowhere to go.
 */
const ReviewNavArrows: React.FC<ReviewNavArrowsProps> = ({
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
  beforeNavigate,
}) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleClick = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (!beforeNavigate) return;
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await beforeNavigate();
    setBusy(false);
    if (!ok) return;
    router.push(href);
  };

  return (
    <>
      {prevHref ? (
        <IconButton
          component={Link}
          href={prevHref}
          aria-label={prevLabel}
          disabled={busy}
          onClick={(event) => void handleClick(event, prevHref)}
          sx={cornerButtonSx("left")}
        >
          <ChevronLeftRoundedIcon sx={{ fontSize: 30 }} />
        </IconButton>
      ) : null}
      {nextHref ? (
        <IconButton
          component={Link}
          href={nextHref}
          aria-label={nextLabel}
          disabled={busy}
          onClick={(event) => void handleClick(event, nextHref)}
          sx={cornerButtonSx("right")}
        >
          <ChevronRightRoundedIcon sx={{ fontSize: 30 }} />
        </IconButton>
      ) : null}
    </>
  );
};

export default ReviewNavArrows;
