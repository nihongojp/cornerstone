"use client";

/* PROTOTYPE — throwaway. See #52.
 *
 * VARIANT C — "Flat method list". No tabs, no progressive disclosure, no
 * primary action. Every way in is a peer row, expanding in place. The bet:
 * with four sign-in methods, discoverability beats hierarchy, and nobody has
 * to guess which box their account lives behind.
 *
 * This is also the variant that most directly satisfies "password plainly
 * available at sign-in" — it is literally a labelled row, not a fallback.
 */

import React, { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Container,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import KeyIcon from "@mui/icons-material/KeyOutlined";
import MailIcon from "@mui/icons-material/MailOutlined";
import { GoogleMark, StateReadout } from "./stubs";

type Method = "google" | "link" | "password" | null;
type Intent = "new" | "returning";

function MethodRow({
  icon,
  title,
  caption,
  open,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  open: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, mb: 1.5, overflow: "hidden", borderColor: open ? "primary.main" : undefined }}
    >
      <Box
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 2,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="center" width={24}>
          {icon}
        </Box>
        <Box flexGrow={1}>
          <Typography variant="body2" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        </Box>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

export default function VariantC() {
  const [intent, setIntent] = useState<Intent>("returning");
  const [open, setOpen] = useState<Method>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  const toggle = (m: Method) => setOpen((cur) => (cur === m ? null : m));

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
            <Box textAlign="center" mb={1}>
              <Typography variant="h5" fontWeight="bold">
                Nihon-Go!
              </Typography>
            </Box>

            <Box textAlign="center" mb={3}>
              <Typography variant="body2" color="text.secondary" component="span">
                {intent === "returning" ? "New here? " : "Already have an account? "}
              </Typography>
              <Link
                component="button"
                underline="hover"
                onClick={() => {
                  setIntent(intent === "returning" ? "new" : "returning");
                  setOpen(null);
                  setSent(false);
                }}
              >
                {intent === "returning" ? "Create an account" : "Sign in"}
              </Link>
            </Box>

            <MethodRow
              icon={<GoogleMark />}
              title="Continue with Google"
              caption="Fastest — no email to wait for"
              open={false}
              onClick={() => toggle("google")}
            />

            <MethodRow
              icon={<MailIcon fontSize="small" color="action" />}
              title="Email me a sign-in link"
              caption={sent ? "Link sent — check your inbox" : "No password to remember"}
              open={open === "link"}
              onClick={() => toggle("link")}
            >
              {!sent ? (
                <>
                  <TextField
                    label="Email"
                    type="email"
                    fullWidth
                    size="small"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={!email}
                    onClick={() => setSent(true)}
                    sx={{ mt: 1.5, textTransform: "none" }}
                  >
                    Send link
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                    Sent to {email}. Expires in 15 minutes.
                  </Typography>
                  <TextField
                    label="Or enter the 6-digit code"
                    fullWidth
                    size="small"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    slotProps={{
                      htmlInput: { inputMode: "numeric", style: { letterSpacing: "0.4em", textAlign: "center" } },
                    }}
                  />
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={code.length !== 6}
                    sx={{ mt: 1.5, textTransform: "none" }}
                  >
                    Sign in
                  </Button>
                  <Box textAlign="center" mt={1}>
                    <Link component="button" underline="hover" onClick={() => setSent(false)}>
                      Use a different email
                    </Link>
                  </Box>
                </>
              )}
            </MethodRow>

            {intent === "returning" && (
              <MethodRow
                icon={<KeyIcon fontSize="small" color="action" />}
                title="Use a password"
                caption="For accounts made before we switched"
                open={open === "password"}
                onClick={() => toggle("password")}
              >
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  size="small"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  size="small"
                  sx={{ mt: 1.5 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  fullWidth
                  variant="contained"
                  disabled={!email || !password}
                  sx={{ mt: 1.5, textTransform: "none" }}
                >
                  Sign in
                </Button>
              </MethodRow>
            )}

            <StateReadout state={{ variant: "C", intent, open, sent, email }} />
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
