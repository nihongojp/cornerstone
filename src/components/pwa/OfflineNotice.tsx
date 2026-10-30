"use client";

import { useEffect, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import WifiOffIcon from "@mui/icons-material/WifiOff";

/*
 * Body of the /offline page. Watches `online` so the learner gets a working
 * button the moment the connection returns, instead of a dead page they have
 * to know to reload.
 */
export default function OfflineNotice() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 3,
        pt: "env(safe-area-inset-top)",
        pb: "env(safe-area-inset-bottom)",
      }}
    >
      <Stack spacing={2} alignItems="center" textAlign="center" maxWidth={420}>
        <WifiOffIcon sx={{ fontSize: 56, color: "#b43d20" }} />
        <Typography variant="h5" component="h1" fontWeight={700}>
          You&apos;re offline
        </Typography>
        <Typography color="text.secondary">
          Nihon-Go needs a connection to load lessons and save your progress.
          Check Wi-Fi or mobile data, then try again.
        </Typography>
        <Button
          variant="contained"
          disableElevation
          onClick={() => window.location.reload()}
          sx={{ bgcolor: "#b43d20", "&:hover": { bgcolor: "#9f341b" } }}
        >
          {online ? "Back online — reload" : "Try again"}
        </Button>
      </Stack>
    </Box>
  );
}
