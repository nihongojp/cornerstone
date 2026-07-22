import React, { useState, ChangeEvent, FormEvent } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Container,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  Alert,
  AlertColor,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { setToken, json } from "../services/api";

const AuthForm = (): React.ReactElement => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    rememberMe: true,
  });

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");
  const [notifSeverity, setNotifSeverity] = useState<AlertColor>("info");

  const location = useLocation() as any;
  const navigate = useNavigate();

  const notify = (msg: string, severity: AlertColor) => {
    setNotifMsg(msg);
    setNotifSeverity(severity);
    setNotifOpen(true);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetFieldsForMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setFormData((prev) => ({
      firstName: nextMode === "signup" ? "" : prev.firstName,
      lastName: nextMode === "signup" ? "" : prev.lastName,
      email: nextMode === "signup" ? "" : prev.email,
      password: "",
      rememberMe: true,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";

      const payload =
        mode === "login"
          ? {
              email: formData.email,
              password: formData.password,
              rememberMe: formData.rememberMe,
            }
          : {
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              password: formData.password,
            };

      const data: any = await json(endpoint, { method: "POST", data: payload });

      if (mode === "signup") {
        const emailFromServer = data?.user?.email || formData.email;
        setMode("login");
        setFormData({
          firstName: "",
          lastName: "",
          email: emailFromServer || "",
          password: "",
          rememberMe: true,
        });
        notify("Account created. Please log in with your password.", "success");
        return;
      }

      if (!data?.token) {
        notify("No token returned from server", "error");
        return;
      }

      setToken(data.token);

      notify("Login successful. Redirecting…", "success");
      const redirectTo = location.state?.from?.pathname || "/new-lessons";

      // IMPORTANT: full reload so header + guards pick up localStorage immediately
      window.location.assign(redirectTo);
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
              {mode === "login" && (
                <img
                  src="https://cdn-icons-png.flaticon.com/512/9288/9288684.png"
                  alt="Cat"
                  width={80}
                  style={{ marginBottom: "12px" }}
                />
              )}
              <Typography variant="h5" fontWeight="bold">
                {mode === "login" ? "Welcome Back!" : "Create Account"}
              </Typography>
              <Typography variant="body2">
                {mode === "login"
                  ? "Let's log back in and learn more Japanese!"
                  : "Join us and start learning Japanese today!"}
              </Typography>
            </Box>

            <ToggleButtonGroup
              color="primary"
              value={mode}
              exclusive
              onChange={(_, newMode) => {
                if (newMode) {
                  if (newMode === "login") {
                    setMode("login");
                    setFormData((prev) => ({
                      firstName: "",
                      lastName: "",
                      email: prev.email,
                      password: "",
                      rememberMe: true,
                    }));
                  } else {
                    resetFieldsForMode("signup");
                  }
                }
              }}
              fullWidth
              sx={{ mb: 2 }}
            >
              <ToggleButton value="login" sx={{ textTransform: "none" }}>
                Login
              </ToggleButton>
              <ToggleButton value="signup" sx={{ textTransform: "none" }}>
                Sign Up
              </ToggleButton>
            </ToggleButtonGroup>

            <form onSubmit={handleSubmit}>
              {mode === "signup" && (
                <>
                  <TextField
                    label="First Name"
                    name="firstName"
                    fullWidth
                    margin="normal"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                  />
                  <TextField
                    label="Last Name"
                    name="lastName"
                    fullWidth
                    margin="normal"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                  />
                </>
              )}

              <TextField
                label={mode === "login" ? "Email or Username" : "Email"}
                name="email"
                type={mode === "login" ? "text" : "email"}
                fullWidth
                margin="normal"
                value={formData.email}
                onChange={handleInputChange}
                required
              />

              <TextField
                label="Password"
                name="password"
                type="password"
                fullWidth
                margin="normal"
                value={formData.password}
                onChange={handleInputChange}
                required
              />

              {mode === "login" && (
                <FormControlLabel
                  control={
                    <Checkbox
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      color="primary"
                    />
                  }
                  label="Remember me"
                />
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ mt: 2, borderRadius: 2 }}
                disabled={loading}
              >
                {loading
                  ? mode === "login"
                    ? "Logging in…"
                    : "Signing up…"
                  : mode === "login"
                  ? "Login"
                  : "Sign Up"}
              </Button>

              {mode === "login" && (
                <Box mt={2} textAlign="center">
                  <Button variant="text" size="small" onClick={() => navigate("/forgot-password")}>
                    Forgot password?
                  </Button>
                </Box>
              )}
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
          sx={{
            width: "100%",
            ...(notifSeverity === "success" && {
              bgcolor: "success.main",
              color: "success.contrastText",
            }),
            ...(notifSeverity === "error" && {
              bgcolor: "error.main",
              color: "error.contrastText",
            }),
          }}
        >
          {notifMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AuthForm;