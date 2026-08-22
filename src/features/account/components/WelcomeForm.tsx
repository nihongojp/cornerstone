"use client";

/*
 * The one step after signing up for the first time (#55).
 *
 * Reached only via `newUserCallbackURL` on the magic link, so by the time it
 * renders the address is proven and a session exists. That is the whole reason
 * it is here rather than on the signup form: `signIn.magicLink` accepts a
 * single `name` string when it creates the account, so a first/last pair asked
 * for before the address was proven would have been flattened into one value and the two
 * columns the profile reads would have stayed empty. With a session, updateUser
 * can set both properly.
 *
 * Google sign-ups never see this — mapProfileToUser fills both columns from the
 * provider profile, so there is nothing left to ask.
 */

import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { saveWelcomeName } from "@/features/account/actions";
import AuthCat from "@/components/AuthCat";

export default function WelcomeForm(): React.ReactElement {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await saveWelcomeName({
      firstName: first.trim(),
      lastName: last.trim(),
    });
    setBusy(false);

    if (error) return setError(error);
    router.push("/lessons");
  }

  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <Box
        component="main"
        flexGrow={1}
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={3}
      >
        <Container maxWidth="xs">
          <Paper elevation={3} sx={{ px: 4, py: 5, borderRadius: 3 }}>
            <Box textAlign="center" mb={3}>
              <AuthCat />
              <Typography variant="h5" fontWeight="bold">
                You&apos;re in!
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
              What should we call you?
            </Typography>

            <Box display="flex" gap={1}>
              <TextField
                label="First name"
                fullWidth
                autoFocus
                value={first}
                onChange={(e) => setFirst(e.target.value)}
              />
              <TextField
                label="Last name"
                fullWidth
                value={last}
                onChange={(e) => setLast(e.target.value)}
              />
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2, px: 1.5, "& .MuiAlert-icon": { mr: 1 } }}>
                {error}
              </Alert>
            )}

            <Button
              fullWidth
              size="large"
              variant="contained"
              disabled={!first.trim() || busy}
              onClick={save}
              sx={{ mt: 2, py: 1.25, textTransform: "none" }}
            >
              {busy ? <CircularProgress size={22} /> : "Start learning"}
            </Button>

            {/*
              * Skippable on purpose. The account already exists and is signed
              * in by this point — blocking the app behind a name would be a
              * wall at the exact moment someone has just succeeded, and it is
              * editable later on the profile.
              */}
            <Box textAlign="center" mt={2}>
              <Button
                variant="text"
                onClick={() => router.push("/lessons")}
                sx={{ textTransform: "none", color: "text.secondary" }}
              >
                Skip for now
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
