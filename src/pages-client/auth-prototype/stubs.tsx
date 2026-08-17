"use client";

/* PROTOTYPE — throwaway. See #52. Not production code.
 *
 * Nothing here talks to better-auth. Every "submit" is a timer. The question
 * this prototype answers is what the screens look like, not whether auth works.
 */

import React from "react";
import { Box, Button, Divider, Typography } from "@mui/material";

/** Whether the typed email already has a password, for the identifier-first flow. */
export function fakeLookup(email: string): "has-password" | "passwordless" {
  // Anything containing "old" pretends to be a legacy account with a password.
  return email.toLowerCase().includes("old") ? "has-password" : "passwordless";
}

export function sleep(ms = 700) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Google's real mark, inlined so the prototype has no network dependency. */
export function GoogleMark() {
  return (
    <Box component="svg" viewBox="0 0 48 48" sx={{ width: 18, height: 18 }}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Box>
  );
}

export function GoogleButton({ onClick, label = "Continue with Google" }: { onClick?: () => void; label?: string }) {
  return (
    <Button
      fullWidth
      variant="outlined"
      size="large"
      onClick={onClick}
      startIcon={<GoogleMark />}
      sx={{ textTransform: "none", py: 1.25, borderColor: "#dadce0", color: "text.primary" }}
    >
      {label}
    </Button>
  );
}

export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <Divider sx={{ my: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Divider>
  );
}

/** Renders the in-memory state so it's visible while clicking through. */
export function StateReadout({ state }: { state: Record<string, unknown> }) {
  return (
    <Box
      sx={{
        mt: 2,
        p: 1,
        borderRadius: 1,
        bgcolor: "#f5f5f5",
        fontFamily: "monospace",
        fontSize: 11,
        color: "#555",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {JSON.stringify(state)}
    </Box>
  );
}
