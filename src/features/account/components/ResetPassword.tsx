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
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-client";

/*
 * Step 2 of the password reset: the destination of the emailed link. The token
 * in the query string is the proof of email ownership that the old
 * reset-password endpoint never asked for.
 */
const ResetPassword = (): React.ReactElement => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ newPassword: "", confirmPassword: "" });
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

    if (formData.newPassword !== formData.confirmPassword) {
      notify("Passwords do not match", "error");
      return;
    }

    if (formData.newPassword.length < 8) {
      notify("Password must be at least 8 characters", "error");
      return;
    }

    if (!token) {
      notify("This reset link is invalid or has expired", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword({ newPassword: formData.newPassword, token });

      if (error) {
        notify(error.message || "This reset link is invalid or has expired", "error");
        return;
      }

      notify("Password reset successfully! Redirecting to login…", "success");
      setTimeout(() => router.push("/auth"), 2000);
    } catch (err: any) {
      notify(err?.message || "Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  const tokenMissing = !token || Boolean(linkError);

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
                Choose a New Password
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {tokenMissing
                  ? "This reset link is invalid or has expired. Request a new one."
                  : "Enter a new password for your account."}
              </Typography>
            </Box>

            {tokenMissing ? (
              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 1, borderRadius: 2 }}
                onClick={() => router.push("/forgot-password")}
              >
                Request a New Link
              </Button>
            ) : (
              <form onSubmit={handleSubmit}>
                <TextField
                  label="New Password"
                  name="newPassword"
                  type="password"
                  fullWidth
                  margin="normal"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  required
                />
                <TextField
                  label="Confirm New Password"
                  name="confirmPassword"
                  type="password"
                  fullWidth
                  margin="normal"
                  value={formData.confirmPassword}
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
                  {loading ? "Resetting…" : "Reset Password"}
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

export default ResetPassword;
