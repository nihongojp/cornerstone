"use client";

/* PROTOTYPE — throwaway. See #52.
 *
 * VARIANT B — "Two surfaces, honest about the difference". Keeps the existing
 * Login / Sign Up tabs, because the two now genuinely offer different method
 * sets: sign-in has a password field, signup does not. Closest to what exists
 * today, so it's the cheapest to build and the least surprising to returning
 * users — the case against A and C.
 */

import React, { useState } from "react";
import {
  Box,
  Button,
  Container,
  Link,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { GoogleButton, OrDivider, StateReadout } from "./stubs";

type Mode = "login" | "signup";
type Stage = "form" | "sent" | "otp";

export default function VariantB() {
  const [mode, setMode] = useState<Mode>("login");
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [code, setCode] = useState("");

  const switchMode = (next: Mode) => {
    setMode(next);
    setStage("form");
    setPassword("");
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
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Box textAlign="center" mb={3}>
              <Typography variant="h5" fontWeight="bold">
                {mode === "login" ? "Welcome Back!" : "Create Account"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mode === "login"
                  ? "Let's log back in and learn more Japanese!"
                  : "Join us and start learning Japanese today!"}
              </Typography>
            </Box>

            <ToggleButtonGroup
              color="primary"
              value={mode}
              exclusive
              fullWidth
              onChange={(_, v) => v && switchMode(v)}
              sx={{ mb: 2 }}
            >
              <ToggleButton value="login" sx={{ textTransform: "none" }}>
                Login
              </ToggleButton>
              <ToggleButton value="signup" sx={{ textTransform: "none" }}>
                Sign Up
              </ToggleButton>
            </ToggleButtonGroup>

            {stage === "form" && (
              <>
                <GoogleButton label={mode === "login" ? "Sign in with Google" : "Sign up with Google"} />
                <OrDivider />

                {mode === "signup" && (
                  <Box display="flex" gap={1}>
                    <TextField
                      label="First name"
                      fullWidth
                      margin="dense"
                      value={first}
                      onChange={(e) => setFirst(e.target.value)}
                    />
                    <TextField
                      label="Last name"
                      fullWidth
                      margin="dense"
                      value={last}
                      onChange={(e) => setLast(e.target.value)}
                    />
                  </Box>
                )}

                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  margin="dense"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                {mode === "login" && (
                  <TextField
                    label="Password"
                    type="password"
                    fullWidth
                    margin="dense"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}

                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  onClick={() => mode === "signup" && setStage("sent")}
                  sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                >
                  {mode === "login" ? "Log in" : "Create account"}
                </Button>

                {mode === "login" ? (
                  <Box textAlign="center" mt={2}>
                    <Link component="button" underline="hover" onClick={() => setStage("sent")}>
                      Email me a sign-in link instead
                    </Link>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
                    We&apos;ll email you a link to finish — no password needed.
                  </Typography>
                )}
              </>
            )}

            {(stage === "sent" || stage === "otp") && (
              <Box>
                <Typography variant="body1" fontWeight={600}>
                  Check your email
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Sent to <strong>{email || "your address"}</strong>. Expires in 15 minutes.
                </Typography>

                {stage === "sent" ? (
                  <Box textAlign="center" mt={3}>
                    <Link component="button" underline="hover" onClick={() => setStage("otp")}>
                      Enter the 6-digit code instead
                    </Link>
                  </Box>
                ) : (
                  <>
                    <TextField
                      label="6-digit code"
                      fullWidth
                      autoFocus
                      margin="normal"
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
                      sx={{ mt: 1, py: 1.25, textTransform: "none" }}
                    >
                      Continue
                    </Button>
                  </>
                )}

                <Box textAlign="center" mt={2}>
                  <Link component="button" underline="hover" onClick={() => setStage("form")}>
                    Back
                  </Link>
                </Box>
              </Box>
            )}

            <StateReadout state={{ variant: "B", mode, stage, email }} />
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
