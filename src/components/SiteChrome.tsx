"use client";

import React from "react";
import { Box } from "@mui/material";
import Header from "./Header";
import Footer from "./Footer";

/*
 * Ported from client/src/App.tsx AppContent. The route groups decide which
 * chrome a page gets ((site) = header+footer, (dashboard) = header only,
 * (player) = bare) — this component reproduces the shared page skeleton and
 * the sticky header wrapper exactly as the CRA app rendered it.
 *
 * Sticky wrapper
 * ─────────────
 * position: sticky + top: 0 keeps the header at the top of the
 * viewport as the user scrolls without removing it from the document
 * flow (unlike position: fixed which would overlap page content).
 *
 * zIndex: 1100 sits above MUI Drawer (1200) siblings but below
 * Modal / Tooltip (1300+), matching MUI's own AppBar convention.
 *
 * The "floating" look comes from MUI AppBar's default box-shadow
 * (elevation 4). We neutralise it here with boxShadow: "none" and
 * replace it with a hairline borderBottom so the header reads as
 * attached to the page rather than hovering above it.
 *
 * px: { xs: 1, sm: 2 } + the inner maxWidth container give the
 * header breathing room from the viewport edges ("gaps around the
 * corners") without needing to change the Header component itself.
 */
export default function SiteChrome({
  children,
  footer = true,
}: {
  children: React.ReactNode;
  footer?: boolean;
}) {
  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1100,
          // Background + border replace the floating shadow
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          // Kill whatever elevation/shadow MUI AppBar adds internally
          "& .MuiAppBar-root": {
            position: "static", // override AppBar's own position so it
            // doesn't fight the sticky wrapper
            boxShadow: "none",
            bgcolor: "transparent",
          },
          // Side breathing room — content doesn't slam into viewport edges
          px: { xs: 1, sm: 2, md: 3 },
        }}
      >
        <Header />
      </Box>

      <Box component="main" flexGrow={1}>
        {children}
      </Box>

      {footer && <Footer />}
    </Box>
  );
}
