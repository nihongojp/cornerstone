"use client";

/*
 * Identifier-first sign-in (#52).
 *
 * The user enters an email; the screen then resolves to whatever that account
 * can do — a password field for an account that has one, "check your email" for
 * everyone else.
 *
 * ## The invariant
 *
 * The lookup decides HOW you authenticate. The Login / Sign Up toggle decides
 * only what you are TOLD — the heading copy, and nothing else. Both sides ask
 * for exactly one thing, an email. A returning user who lands on Sign Up is
 * signed in, not rejected; a new address entered on Login is sent a link, not
 * refused.
 *
 * Both sides call the same two functions below. If a future change makes Sign
 * Up reject an existing account — or Login refuse a new one — this has silently
 * become two flows again and lost the property it was chosen for.
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
import { useRouter, useSearchParams } from "next/navigation";
import { emailOtp, signIn } from "../lib/auth-client";

type Mode = "login" | "signup";
type Stage = "email" | "password" | "sent" | "otp" | "linkFailed" | "sendFailed";
type Notice = null | "wrongCode" | "rateLimited" | "resent";

const alertSx = {
  mt: 2,
  textAlign: "left" as const,
  px: 1.5,
  "& .MuiAlert-icon": { mr: 1 },
};

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

export default function AuthForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Where the proxy wanted the user to end up before it bounced them here.
  const from = searchParams.get("from") || "/new-lessons";

  /*
   * Better Auth redirects a failed magic-link verification back here with
   * `?error=`. Note it cannot tell us *why*: `consumeVerificationValue` returns
   * nothing whether the token expired, was already used, or was superseded by a
   * resend, and all three arrive as INVALID_TOKEN. The copy below covers all
   * three rather than claiming one.
   */
  const linkError = searchParams.get("error");

  // /signup redirects here as ?mode=signup, so the old routes still land people
  // on the side they asked for rather than always on Login.
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [stage, setStage] = useState<Stage>(linkError ? "linkFailed" : "email");
  const [notice, setNotice] = useState<Notice>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const go = (s: Stage, n: Notice = null) => {
    setStage(s);
    setNotice(n);
    setMessage(null);
  };

  const back = () => {
    go("email");
    setPassword("");
    setCode("");
  };

  /** Send the sign-in link. Identical on both sides of the toggle. */
  async function sendLink(resend = false) {
    setBusy(true);
    const { error } = await signIn.magicLink({
      email,
      callbackURL: from,
      // Only used when the address turns out to be new. This is what makes
      // "ask for a name" a post-verification step rather than a signup field.
      newUserCallbackURL: "/welcome",
      errorCallbackURL: "/auth",
    });
    setBusy(false);

    if (error) return go("sendFailed");
    go("sent", resend ? "resent" : null);
  }

  /**
   * The identifier lookup. Deliberately fails OPEN: if it errors or is rate
   * limited we send a link rather than blocking sign-in, because the lookup is
   * an optimisation for legacy password users, not a gate.
   */
  async function resolveEmail() {
    setBusy(true);
    let hasPassword = false;
    try {
      const res = await fetch("/api/auth/identifier-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) hasPassword = (await res.json()).hasPassword === true;
    } catch {
      // Fall through to the link path.
    }
    setBusy(false);

    if (hasPassword) return go("password");
    await sendLink();
  }

  async function submitPassword() {
    setBusy(true);
    const { error } = await signIn.email({ email, password });
    setBusy(false);
    if (error) return setMessage(error.message ?? "That didn't work.");
    router.push(from);
  }

  async function requestCode() {
    setBusy(true);
    const { error } = await emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setBusy(false);
    if (error) return go("sendFailed");
    go("otp");
  }

  async function submitCode() {
    setBusy(true);
    const { error } = await signIn.emailOtp({ email, otp: code });
    setBusy(false);
    if (error) {
      // 429 is the rate limiter; anything else is a bad or stale code.
      return setNotice(error.status === 429 ? "rateLimited" : "wrongCode");
    }
    router.push(from);
  }

  const headings: Record<Stage, string> = {
    email: mode === "login" ? "Welcome Back!" : "Create Account",
    /*
     * Not mode-dependent. Reaching this screen means the lookup found an
     * account with a password, so the user is signing in whichever side of the
     * toggle they started on. "Create Account" above "Signing in as …" is the
     * toggle's framing outliving the moment it stopped being true.
     */
    password: "Welcome Back!",
    sent: mode === "login" ? "Welcome Back!" : "Create Account",
    otp: mode === "login" ? "Welcome Back!" : "Create Account",
    linkFailed: "That link didn't work",
    sendFailed: "We couldn't send that email",
  };

  // Arrival states have no previous screen — the user got here from a mailbox —
  // so they carry their own way onward instead of a back chevron.
  const showBack = stage !== "email" && stage !== "linkFailed";

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
          <Paper elevation={3} sx={{ px: 4, py: 5, borderRadius: 3, position: "relative" }}>
            {showBack && (
              <IconButton
                aria-label="Back"
                onClick={back}
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

                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  onClick={() => signIn.social({ provider: "google", callbackURL: from })}
                  sx={{ textTransform: "none", py: 1.25 }}
                >
                  {mode === "login" ? "Sign in with Google" : "Sign up with Google"}
                </Button>

                <Divider sx={{ my: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    or
                  </Typography>
                </Divider>

                {/*
                  * No name field here, on either side of the toggle.
                  *
                  * The design originally collected it on Sign Up, on the
                  * assumption that it would populate firstName/lastName. It
                  * cannot: magic link accepts a single `name` string when it
                  * creates the account, so a first/last pair would have been
                  * silently flattened, and one combined field could not fill
                  * the two columns the profile actually reads.
                  *
                  * New users are sent to /welcome after verifying instead
                  * (`newUserCallbackURL` below), where there is a session and
                  * `updateUser` can set both columns properly. The upside is
                  * that both sides of the toggle now ask for exactly one
                  * thing, which is what identifier-first is for.
                  */}
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email && resolveEmail()}
                />
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={!email || busy}
                  onClick={resolveEmail}
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
                  onKeyDown={(e) => e.key === "Enter" && password && submitPassword()}
                />
                {message && (
                  <Alert severity="error" sx={alertSx}>
                    {message}
                  </Alert>
                )}
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={!password || busy}
                  onClick={submitPassword}
                  sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                >
                  {busy ? <CircularProgress size={22} /> : "Sign in"}
                </Button>
                <Box mt={2}>
                  <Link component="button" underline="hover" onClick={() => sendLink()}>
                    Email me a sign-in link instead
                  </Link>
                </Box>
                <Box mt={1}>
                  {/*
                    * Hands off to the existing /forgot-password page rather
                    * than calling requestPasswordReset here. That page owns the
                    * `redirectTo: "/reset-password"` the reset link depends on,
                    * and its own sent/error states; issuing the request from
                    * here would have to duplicate both, and getting redirectTo
                    * wrong sends people somewhere the token cannot be used.
                    */}
                  <Link
                    component="button"
                    variant="caption"
                    underline="hover"
                    onClick={() => router.push("/forgot-password")}
                  >
                    Forgot your password?
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

                {notice === "resent" && (
                  <Alert severity="success" sx={alertSx}>
                    Sent again. Older links no longer work.
                  </Alert>
                )}

                <Divider sx={{ mx: 3, mt: 3 }} />

                {stage === "sent" ? (
                  <Box mt={2}>
                    <Link component="button" underline="hover" onClick={requestCode}>
                      Enter the 6-digit code instead
                    </Link>
                  </Box>
                ) : (
                  <Box mt={2}>
                    <TextField
                      label="6-digit code"
                      fullWidth
                      autoFocus
                      disabled={notice === "rateLimited"}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      slotProps={{
                        htmlInput: {
                          inputMode: "numeric",
                          style: { letterSpacing: "0.5em", fontSize: 22, textAlign: "center" },
                        },
                      }}
                    />
                    {notice === "wrongCode" && (
                      <Alert severity="error" sx={alertSx}>
                        That code didn&apos;t work.
                      </Alert>
                    )}
                    {notice === "rateLimited" && (
                      <Alert severity="warning" sx={alertSx}>
                        Too many attempts, try again in a few minutes.
                      </Alert>
                    )}
                    <Button
                      fullWidth
                      size="large"
                      variant="contained"
                      disabled={code.length !== 6 || busy || notice === "rateLimited"}
                      onClick={submitCode}
                      sx={{ mt: 2, py: 1.25, textTransform: "none" }}
                    >
                      {busy ? <CircularProgress size={22} /> : "Sign in"}
                    </Button>
                  </Box>
                )}

                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    Didn&apos;t arrive?{" "}
                    <Link component="button" underline="hover" onClick={() => sendLink(true)}>
                      Resend
                    </Link>
                  </Typography>
                </Box>
              </Box>
            )}

            {stage === "linkFailed" && (
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Sign-in links last 15 minutes and can only be used once. This one
                  has expired, has already been used, or was replaced by a newer one.
                </Typography>
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  onClick={back}
                  sx={{ mt: 3, py: 1.25, textTransform: "none" }}
                >
                  Start again
                </Button>
              </Box>
            )}

            {stage === "sendFailed" && (
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Something went wrong sending to <strong>{email}</strong>. This is on
                  us, not you.
                </Typography>
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={busy}
                  onClick={() => sendLink()}
                  sx={{ mt: 3, py: 1.25, textTransform: "none" }}
                >
                  Try again
                </Button>
                <Divider sx={{ mx: 3, mt: 3 }} />
                {/* The paths that don't depend on mail arriving. */}
                <Box mt={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => signIn.social({ provider: "google", callbackURL: from })}
                    sx={{ textTransform: "none" }}
                  >
                    Continue with Google instead
                  </Button>
                </Box>
                <Box mt={2}>
                  <Link component="button" underline="hover" onClick={back}>
                    Use a different email
                  </Link>
                </Box>
              </Box>
            )}
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
