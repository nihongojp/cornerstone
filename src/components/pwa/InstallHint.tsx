"use client";

import { useEffect, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IosShareIcon from "@mui/icons-material/IosShare";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";

const DISMISS_KEY = "nihongo.installHint.dismissedAt";
const DISMISS_FOR_DAYS = 30;

/*
 * iOS-only "Add to Home Screen" nudge.
 *
 * Safari on iPhone never fires `beforeinstallprompt` and has no install
 * button of its own, so the only way a learner finds out the site installs
 * is to be told. Chrome on Android shows its own prompt, so this stays
 * hidden there.
 *
 * Shown when all of these hold:
 *   - the user agent is an iPhone/iPad/iPod,
 *   - the page is not already running standalone (i.e. not yet installed),
 *   - the learner hasn't dismissed it in the last 30 days.
 *
 * Everything is decided in an effect, so the server render and first client
 * render agree (null) and there is no hydration mismatch.
 */
export default function InstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    // `standalone` is Safari's non-standard flag; the media query is the
    // standard one. Either means "already installed".
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!isIOS || standalone) return;

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      const ageDays = (Date.now() - dismissedAt) / 86_400_000;
      if (dismissedAt && ageDays < DISMISS_FOR_DAYS) return;
    } catch {
      // localStorage can throw in private mode; fall through and show it.
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1,
        bgcolor: "#fdf3ef",
        borderBottom: "1px solid",
        borderColor: "divider",
        fontSize: 14,
      }}
    >
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        Add Nihon-Go to your Home Screen: tap{" "}
        <IosShareIcon fontSize="inherit" sx={{ verticalAlign: "-2px" }} /> Share, then{" "}
        <AddBoxOutlinedIcon fontSize="inherit" sx={{ verticalAlign: "-2px" }} /> Add to Home
        Screen.
      </Typography>
      <IconButton size="small" aria-label="Dismiss" onClick={dismiss}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
