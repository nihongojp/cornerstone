"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Container,
  Snackbar,
  Alert,
  AlertColor,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { requestPasswordReset } from "@/lib/auth-client";

/*
 * Step 1 of the password reset. This page used to take an email plus a new
 * password and reset the account outright, which let anyone take over any
 * account just by knowing its email address. It now only sends a tokened link;
 * the new password is chosen on /reset-password, which requires that token.
 */
const ForgotPassword = (): React.ReactElement => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formData, setFormData] = useState({ email: "" });
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");
  const [notifSeverity, setNotifSeverity] = useState<AlertColor>("info");

  const notify = (msg: string, severity: AlertColor) => {
    setNotifMsg(msg);
    setNotifSeverity(severity);
    setNotifOpen(true);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    try {
      const { error } = await requestPasswordReset({
        email: formData.email,
        redirectTo: "/reset-password",
      });

      if (error) {
        notify(error.message || "Network error", "error");
        return;
      }

      // Deliberately the same response whether or not the address has an
      // account, so this page can't be used to discover who is registered.
      setSent(true);
      notify("If that email has an account, a reset link is on its way.", "success");
    } catch (err: any) {
      notify(err?.message || "Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <Box
        component="main"
        flexGrow={1}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        px={3}
      >
        <Container maxWidth="xs">
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Box textAlign="center" mb={3}>
              <Typography variant="h5" fontWeight="bold">
                Reset Password
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {sent
                  ? "Check your inbox for a link to choose a new password. The link expires in one hour."
                  : "Enter your email and we'll send you a reset link."}
              </Typography>
            </Box>

            {!sent && (
              <form onSubmit={handleSubmit}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  fullWidth
                  margin="normal"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2, borderRadius: 2 }}
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send Reset Link"}
                </Button>
              </form>
            )}

            <Box mt={2} textAlign="center">
              <Button variant="text" size="small" onClick={() => router.push("/auth")}>
                Back to Login
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>

      <Snackbar
        open={notifOpen}
        autoHideDuration={4000}
        onClose={() => setNotifOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setNotifOpen(false)}
          severity={notifSeverity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notifMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ForgotPassword;
