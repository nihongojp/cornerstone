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
import { useNavigate } from "react-router-dom";
import { json } from "../services/api";

const ForgotPassword = (): React.ReactElement => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", newPassword: "", confirmPassword: "" });
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

    if (formData.newPassword.length < 6) {
      notify("Password must be at least 6 characters", "error");
      return;
    }

    setLoading(true);
    try {
      await json("/api/auth/reset-password", {
        method: "POST",
        data: { email: formData.email, newPassword: formData.newPassword },
      });
      notify("Password reset successfully! Redirecting to login…", "success");
      setTimeout(() => navigate("/auth"), 2000);
    } catch (err: any) {
      notify(err?.response?.data?.message || err?.message || "Network error", "error");
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
                Enter your email and choose a new password.
              </Typography>
            </Box>

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

              <Box mt={2} textAlign="center">
                <Button variant="text" size="small" onClick={() => navigate("/auth")}>
                  Back to Login
                </Button>
              </Box>
            </form>
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
