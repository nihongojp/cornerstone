"use client";

/* PROTOTYPE — throwaway. See #52.
 *
 * VARIANT A — "Identifier first". One surface, no tabs. You type an email; the
 * screen then resolves to whatever that account can actually do. Signup and
 * sign-in are the same act, which is only possible because passwordless makes
 * "do you already exist" an implementation detail rather than a question we
 * make the user answer.
 *
 * Type an email containing "old" to simulate a legacy account with a password.
 */

import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { GoogleButton, OrDivider, StateReadout, fakeLookup, sleep } from "./stubs";

type Stage = "email" | "password" | "sent" | "otp";

export default function VariantA() {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = async () => {
    setBusy(true);
    await sleep();
    setBusy(false);
    setStage(fakeLookup(email) === "has-password" ? "password" : "sent");
  };

  const reset = () => {
    setStage("email");
    setPassword("");
    setCode("");
  };

  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <Box
        component="main"
        flexGrow={1}
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={3}
        pb={12}
      >
        <Container maxWidth="xs">
          <Paper elevation={3} sx={{ px: 4, py: 5, borderRadius: 3, position: "relative" }}>
            {/* One way back, everywhere. Returning to the email step is
                implicitly how you use a different address. */}
            {stage !== "email" && (
              <IconButton
                aria-label="Back"
                onClick={reset}
                size="small"
                sx={{ position: "absolute", top: 16, left: 16, color: "text.secondary" }}
              >
                <ChevronLeftIcon />
              </IconButton>
            )}

            <Box textAlign="center" mb={3}>
              <Typography variant="h5" fontWeight="bold">
                Sign in to Nihon-Go!
              </Typography>
            </Box>

            {stage === "email" && (
              <>
                <GoogleButton />
                <OrDivider />
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email && submitEmail()}
                />
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={!email || busy}
                  onClick={submitEmail}
                  sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                >
                  {busy ? <CircularProgress size={22} /> : "Continue"}
                </Button>
              </>
            )}

            {stage === "password" && (
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Signing in as <strong>{email}</strong>
                </Typography>
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={!password}
                  sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                >
                  Sign in
                </Button>
                <Box mt={2}>
                  <Link component="button" underline="hover" onClick={() => setStage("sent")}>
                    Email me a sign-in link instead
                  </Link>
                </Box>
              </Box>
            )}

            {(stage === "sent" || stage === "otp") && (
              <Box textAlign="center">
                <Typography variant="body1" fontWeight={600}>
                  Check your email
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  We sent a link to <strong>{email}</strong>.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  It expires in 15 minutes.
                </Typography>

                <Divider sx={{ mx: 3, mt: 3 }} />

                {stage === "sent" ? (
                  <Box mt={2}>
                    <Link component="button" underline="hover" onClick={() => setStage("otp")}>
                      Enter the 6-digit code instead
                    </Link>
                  </Box>
                ) : (
                  <Box mt={2}>
                    <TextField
                      label="6-digit code"
                      fullWidth
                      autoFocus
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      slotProps={{
                        htmlInput: {
                          inputMode: "numeric",
                          style: { letterSpacing: "0.5em", fontSize: 22, textAlign: "center" },
                        },
                      }}
                    />
                    <Button
                      fullWidth
                      size="large"
                      variant="contained"
                      disabled={code.length !== 6}
                      sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                    >
                      Sign in
                    </Button>
                  </Box>
                )}

                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    Didn&apos;t arrive? <Link component="button" underline="hover">Resend</Link>
                  </Typography>
                </Box>
              </Box>
            )}

            <StateReadout state={{ variant: "A", stage, email, hasPassword: email ? fakeLookup(email) : null }} />
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
