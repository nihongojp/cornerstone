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
 * The strip at the bottom of the card jumps to the error and edge states,
 * which have no other way to be reached without a real mailbox.
 */

import React, { useState } from "react";
import {
  Alert,
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
type Stage =
  | "email"
  | "password"
  | "sent"
  | "otp"
  | "done"
  /* Arrival states — reached by opening a link, never by clicking through. */
  | "expired"
  | "otherBrowser"
  | "sendFailed";
/* Conditions that annotate a screen rather than replacing it. */
type Notice = null | "wrongCode" | "rateLimited" | "resent";

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

function CodeField({
  code,
  setCode,
  disabled,
}: {
  code: string;
  setCode: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <TextField
      label="6-digit code"
      fullWidth
      autoFocus
      disabled={disabled}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      slotProps={{
        htmlInput: {
          inputMode: "numeric",
          style: { letterSpacing: "0.5em", fontSize: 22, textAlign: "center" },
        },
      }}
    />
  );
}

export default function AuthPrototype() {
  const [mode, setMode] = useState<Mode>("login");
  const [stage, setStage] = useState<Stage>("email");
  const [notice, setNotice] = useState<Notice>(null);
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

  const go = (s: Stage, n: Notice = null) => {
    setStage(s);
    setNotice(n);
  };

  const submitEmail = async () => {
    setBusy(true);
    await sleep();
    setBusy(false);
    if (mode === "signup") return go("sent");
    go(fakeLookup(email) === "has-password" ? "password" : "sent");
  };

  const reset = () => {
    go("email");
    setPassword("");
    setCode("");
  };

  const headings: Record<Stage, string> = {
    email: mode === "login" ? "Welcome Back!" : "Create Account",
    password: mode === "login" ? "Welcome Back!" : "Create Account",
    sent: mode === "login" ? "Welcome Back!" : "Create Account",
    otp: mode === "login" ? "Welcome Back!" : "Create Account",
    done: "You're in!",
    expired: "That link expired",
    otherBrowser: "One more step",
    sendFailed: "We couldn't send that email",
  };

  /* The back chevron is offered wherever there is a previous screen to return
     to. Arrival states have none — the user got there from their inbox, not
     from here — so they carry their own explicit way onward instead. */
  const showBack = stage !== "email" && stage !== "done" && stage !== "expired";

  const displayEmail = email || "your address";

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
            {showBack && (
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
                  Signing in as <strong>{displayEmail}</strong>
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
                  onClick={() => go("done")}
                  sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                >
                  Sign in
                </Button>
                <Box mt={2}>
                  <Link component="button" underline="hover" onClick={() => go("sent")}>
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
                  We sent a link to <strong>{displayEmail}</strong>.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  It expires in 15 minutes.
                </Typography>

                {notice === "resent" && (
                  <Alert severity="success" sx={{ mt: 2, textAlign: "left" }}>
                    Sent again. Older links no longer work.
                  </Alert>
                )}

                <Divider sx={{ mx: 3, mt: 3 }} />

                {stage === "sent" ? (
                  <Box mt={2}>
                    <Link component="button" underline="hover" onClick={() => go("otp")}>
                      Enter the 6-digit code instead
                    </Link>
                  </Box>
                ) : (
                  <Box mt={2}>
                    <CodeField code={code} setCode={setCode} disabled={notice === "rateLimited"} />

                    {notice === "wrongCode" && (
                      <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
                        That code isn&apos;t right. Check the email and try again.
                      </Alert>
                    )}
                    {notice === "rateLimited" && (
                      <Alert severity="warning" sx={{ mt: 2, textAlign: "left" }}>
                        Too many attempts. Try again in 5 minutes, or request a new link.
                      </Alert>
                    )}

                    <Button
                      fullWidth
                      size="large"
                      variant="contained"
                      disabled={code.length !== 6 || notice === "rateLimited"}
                      onClick={() => go("done")}
                      sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                    >
                      Sign in
                    </Button>
                  </Box>
                )}

                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    Didn&apos;t arrive?{" "}
                    <Link
                      component="button"
                      underline="hover"
                      onClick={() => setNotice("resent")}
                    >
                      Resend
                    </Link>
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Arrival state: the link was valid but is past its window. The
                only useful action is a fresh one, so that is the primary
                button rather than a link buried under an apology. */}
            {stage === "expired" && (
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Sign-in links last 15 minutes. This one is older than that, so it
                  won&apos;t work any more.
                </Typography>
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  onClick={() => go("sent", "resent")}
                  sx={{ mt: 3, py: 1.25, textTransform: "none" }}
                >
                  Send a new link
                </Button>
                <Box mt={2}>
                  <Link component="button" underline="hover" onClick={reset}>
                    Use a different email
                  </Link>
                </Box>
              </Box>
            )}

            {/* Arrival state: the link opened somewhere other than the browser
                that asked for it. Leads with the code field rather than making
                the user go and find it — the code is in the same email, and it
                is the one credential that works from anywhere. */}
            {stage === "otherBrowser" && (
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary" mb={2}>
                  You opened this link in a different browser from the one that asked
                  for it, so we can&apos;t sign you in automatically. The same email has
                  a 6-digit code — that works anywhere.
                </Typography>
                <CodeField code={code} setCode={setCode} />
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={code.length !== 6}
                  onClick={() => go("done")}
                  sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                >
                  Sign in
                </Button>
              </Box>
            )}

            {/* The failure the map calls the real Phase 1 risk: under
                passwordless, mail *is* the login system. Says plainly that the
                problem is ours, and offers the paths that do not depend on
                mail arriving. */}
            {stage === "sendFailed" && (
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Something went wrong sending to <strong>{displayEmail}</strong>. This
                  is on us, not you.
                </Typography>
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  onClick={() => go("sent")}
                  sx={{ mt: 3, py: 1.25, textTransform: "none" }}
                >
                  Try again
                </Button>
                <Divider sx={{ mx: 3, mt: 3 }} />
                <Box mt={2}>
                  <GoogleButton label="Continue with Google instead" />
                </Box>
                <Box mt={2}>
                  <Link component="button" underline="hover" onClick={reset}>
                    Use a different email
                  </Link>
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
                    go("email");
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

            <StateReadout
              state={{ mode, stage, notice, email, isNewAccount: email ? isNewAccount : null }}
            />

            {/* PROTOTYPE SCAFFOLDING — the error states arrive from a mailbox,
                so there is no way to click into them. Not part of the design. */}
            <Box mt={1} sx={{ borderTop: "1px dashed #ccc", pt: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                jump to:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {(
                  [
                    ["expired link", () => go("expired")],
                    ["other browser", () => go("otherBrowser")],
                    ["send failed", () => go("sendFailed")],
                    ["wrong code", () => go("otp", "wrongCode")],
                    ["rate limited", () => go("otp", "rateLimited")],
                  ] as const
                ).map(([label, onClick]) => (
                  <Button
                    key={label}
                    size="small"
                    variant="outlined"
                    onClick={onClick}
                    sx={{ textTransform: "none", fontSize: 11, py: 0, minWidth: 0 }}
                  >
                    {label}
                  </Button>
                ))}
              </Box>
            </Box>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
