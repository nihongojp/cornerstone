"use client";

/* PROTOTYPE — throwaway. See #52. Not production code. */

import React, { useEffect } from "react";
import { Box, IconButton, Typography, Paper } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Props = {
  variants: { key: string; name: string }[];
  current: string;
};

export default function PrototypeSwitcher({ variants, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  const go = React.useCallback(
    (delta: number) => {
      const next = variants[(index + delta + variants.length) % variants.length];
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", next.key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [index, variants, searchParams, router, pathname],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // A stray merge must never ship this bar to real users.
  if (process.env.NODE_ENV === "production") return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.5,
        borderRadius: 99,
        bgcolor: "#111",
        color: "#fff",
        zIndex: 9999,
      }}
    >
      <IconButton size="small" onClick={() => go(-1)} sx={{ color: "#fff" }}>
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <Typography variant="caption" sx={{ px: 1, whiteSpace: "nowrap", fontWeight: 600 }}>
        {variants[index].key} — {variants[index].name}
      </Typography>
      <IconButton size="small" onClick={() => go(1)} sx={{ color: "#fff" }}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}
