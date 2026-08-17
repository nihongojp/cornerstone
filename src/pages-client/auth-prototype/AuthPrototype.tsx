"use client";

/* PROTOTYPE — throwaway. See #52.
 *
 * The chosen design: identifier-first, with the Login / Sign Up toggle carrying
 * framing rather than mechanism. The email lookup still decides how you
 * authenticate — a returning user who lands on Sign Up is signed in, not
 * rejected. That invariant is the reason this design was chosen; if Sign Up
 * ever starts *refusing* existing accounts, it has reverted to two flows.
 *
 * Name is collected on the Sign Up side, before the link is sent. The
 * alternative — collecting it after the user returns through the link — was
 * built and rejected: it kept both sides identical up to the point of proving
 * the address, but left the account briefly nameless.
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
type Stage = "email" | "password" | "sent" | "otp" | "done";

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

  // Surfaced in the state readout only — nothing branches on it any more. It is
  // what the lookup learns about an address, which is exactly the leak #59 is
  // about.
  const isNewAccount = fakeLookup(email) !== "has-password";

  const submitEmail = async () => {
    setBusy(true);
    await sleep();
    setBusy(false);
    if (mode === "signup") return setStage("sent");
    setStage(fakeLookup(email) === "has-password" ? "password" : "sent");
  };

  const reset = () => {
    setStage("email");
    setPassword("");
    setCode("");
  };

  const headings: Record<Stage, string> = {
    email: mode === "login" ? "Welcome Back!" : "Create Account",
    password: mode === "login" ? "Welcome Back!" : "Create Account",
    sent: mode === "login" ? "Welcome Back!" : "Create Account",
    otp: mode === "login" ? "Welcome Back!" : "Create Account",
    done: "You're in!",
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
                implicitly how you use a different address. Not offered once
                the account exists — there is nothing to go back to. */}
            {stage !== "email" && stage !== "done" && (
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
              <Cat />
              <Typography variant="h5" fontWeight="bold">
                {headings[stage]}
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
                  onClick={() => setStage("done")}
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
                      onClick={() => setStage("done")}
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

            {stage === "done" && (
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  {first ? `Nice to meet you, ${first}.` : "Signed in."} This is where the
                  app would take over.
                </Typography>
                <Button
                  fullWidth
                  size="large"
                  variant="outlined"
                  onClick={() => {
                    setStage("email");
                    setEmail("");
                    setFirst("");
                    setLast("");
                    setCode("");
                    setPassword("");
                  }}
                  sx={{ mt: 3, py: 1.25, textTransform: "none" }}
                >
                  Run it again
                </Button>
              </Box>
            )}

            <StateReadout state={{ mode, stage, email, isNewAccount: email ? isNewAccount : null, first }} />
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
