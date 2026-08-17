"use client";

/* PROTOTYPE — throwaway. See #52.
 *
 * The chosen design: identifier-first (variant A), now with the Login / Sign Up
 * toggle restored from variant B.
 *
 * The toggle deliberately does NOT decide the auth mechanism — the email lookup
 * still does that, which is the whole point of identifier-first. What the toggle
 * carries is framing: heading copy, the cat, and the name fields that only
 * signup needs. A returning user who lands on Sign Up still gets signed in.
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { GoogleButton, OrDivider, StateReadout, fakeLookup, sleep } from "./stubs";

type Mode = "login" | "signup";
type Stage = "email" | "password" | "sent" | "otp";

/* Same asset the current AuthForm uses, so this reads as the existing app. */
function Cat() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://cdn-icons-png.flaticon.com/512/9288/9288684.png"
      alt=""
      width={80}
      style={{ marginBottom: 12 }}
    />
  );
}

export default function AuthPrototype() {
  const [mode, setMode] = useState<Mode>("login");
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = async () => {
    setBusy(true);
    await sleep();
    setBusy(false);
    // Signup always mails a link. Login resolves against the account, which is
    // the identifier-first behaviour the toggle must not override.
    if (mode === "signup") return setStage("sent");
    setStage(fakeLookup(email) === "has-password" ? "password" : "sent");
  };

  const reset = () => {
    setStage("email");
    setPassword("");
    setCode("");
  };

  const showCat = (stage === "email" && mode === "login") || stage === "otp";

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
              {showCat && <Cat />}
              <Typography variant="h5" fontWeight="bold">
                {mode === "login" ? "Welcome Back!" : "Create Account"}
              </Typography>
            </Box>

            {stage === "email" && (
              <>
                <ToggleButtonGroup
                  color="primary"
                  value={mode}
                  exclusive
                  fullWidth
                  onChange={(_, v) => v && setMode(v)}
                  sx={{ mb: 2 }}
                >
                  <ToggleButton value="login" sx={{ textTransform: "none" }}>
                    Login
                  </ToggleButton>
                  <ToggleButton value="signup" sx={{ textTransform: "none" }}>
                    Sign Up
                  </ToggleButton>
                </ToggleButtonGroup>

                <GoogleButton
                  label={mode === "login" ? "Sign in with Google" : "Sign up with Google"}
                />
                <OrDivider />

                {mode === "signup" && (
                  <Box display="flex" gap={1} mb={1}>
                    <TextField
                      label="First name"
                      fullWidth
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
                )}

                <TextField
                  label="Email"
                  type="email"
                  fullWidth
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

            <StateReadout state={{ mode, stage, email, hasPassword: email ? fakeLookup(email) : null }} />
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
