"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Snackbar,
  Alert,
  TextField,
  Tooltip,
  Typography,
  useTheme,
  Paper,
} from "@mui/material";
import { deepPurple } from "@mui/material/colors";
import { Edit, Save, Key, Delete, RefreshCcw, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { deleteAccount, updatePassword, updateProfile } from "@/features/account/actions";

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  rememberMe?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

const initials = (firstName?: string, lastName?: string) =>
  (`${(firstName?.[0] || "").toUpperCase()}${(lastName?.[0] || "").toUpperCase()}` || "U");

const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "—");

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeUser(payload: any): UserProfile | null {
  if (!payload) return null;
  const u = payload.user ?? payload.data?.user ?? payload;
  if (!u) return null;

  return {
    firstName: u.firstName ?? u.first_name ?? "",
    lastName: u.lastName ?? u.last_name ?? "",
    email: u.email ?? "",
    rememberMe: u.rememberMe ?? u.remember_me,
    createdAt: u.createdAt ?? u.created_at,
    updatedAt: u.updatedAt ?? u.updated_at,
    lastLogin: u.lastLogin ?? u.last_login,
  };
}

const Profile: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();

  const { data: session, isPending, refetch } = useSession();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const user = useMemo(() => normalizeUser(session?.user), [session]);
  const [draft, setDraft] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user) {
      setDraft(clone(user));
    }
  }, [user]);

  const onChange =
    (field: keyof UserProfile) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((prev) => (prev ? { ...prev, [field]: e.target.value } : prev));

  const handleSave = async () => {
    if (!draft) return;

    try {
      setSaving(true);
      setError(null);

      console.log("[PROFILE] saving profile", draft);

      const { error: nameError } = await updateProfile({
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        currentEmail: user?.email ?? "",
      });

      if (nameError) {
        const msg = nameError;
        console.error("[PROFILE] save error:", msg);
        setError(msg);
        return;
      }

      setSuccess("Profile updated");
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "" });

  const submitPassword = async () => {
    setError(null);

    console.log("[PROFILE] change password");
    const { error: pwError } = await updatePassword({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    });

    if (pwError) {
      console.error("[PROFILE] change password error:", pwError);
      setError(pwError);
      return;
    }

    setSuccess("Password updated");
    setPwOpen(false);
    setPwForm({ currentPassword: "", newPassword: "" });
  };

  const [delOpen, setDelOpen] = useState(false);
  const confirmDelete = async () => {
    setError(null);
    console.log("[PROFILE] delete account");

    const { error: delError } = await deleteAccount();

    if (delError) {
      console.error("[PROFILE] delete error:", delError);
      setError(delError);
      return;
    }

    router.replace("/");
  };

  const gradientBg = useMemo(
    () =>
      `linear-gradient(135deg, ${
        theme.palette.mode === "dark" ? "#1f2937" : "#e3f2fd"
      } 0%, ${theme.palette.mode === "dark" ? "#111827" : "#f3e8ff"} 100%)`,
    [theme.palette.mode]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.palette.background.default }}>
      <Box
        sx={{
          px: { xs: 2, sm: 4 },
          py: { xs: 3, sm: 6 },
          background: gradientBg,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: deepPurple[500], width: 64, height: 64 }}>
            {initials(user?.firstName, user?.lastName)}
          </Avatar>

          <Box>
            <Typography variant="h5" fontWeight={800}>
              {user ? `${user.firstName} ${user.lastName}` : "Your Profile"}
            </Typography>

            <Box display="flex" alignItems="center" gap={1} sx={{ mt: 0.5 }}>
              <Mail size={16} />
              <Typography variant="body2" color="text.secondary">
                {user?.email || "—"}
              </Typography>

              {user?.rememberMe !== undefined && (
                <Chip size="small" label={user.rememberMe ? "Remembered" : "Session"} />
              )}
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1 }} />
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 4 } }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader
                title={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6" fontWeight={900}>
                      Personal Details
                    </Typography>
                    <Chip size="small" label={editing ? "Editing" : "Read-only"} />
                  </Box>
                }
                action={
                  editing ? (
                    <Box>
                      <Tooltip title="Save">
                        <span>
                          <IconButton onClick={handleSave} disabled={saving}>
                            {saving ? <CircularProgress size={20} /> : <Save />}
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Cancel">
                        <IconButton
                          onClick={() => {
                            setEditing(false);
                            setDraft(user ? clone(user) : null);
                          }}
                        >
                          <RefreshCcw />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Tooltip title="Edit">
                      <IconButton onClick={() => setEditing(true)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  )
                }
              />

              <Divider />

              <CardContent>
                {isPending ? (
                  <Box display="flex" justifyContent="center" py={6}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="First Name"
                        fullWidth
                        value={draft?.firstName || ""}
                        onChange={onChange("firstName")}
                        disabled={!editing}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Last Name"
                        fullWidth
                        value={draft?.lastName || ""}
                        onChange={onChange("lastName")}
                        disabled={!editing}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        label="Email"
                        type="email"
                        fullWidth
                        value={draft?.email || ""}
                        onChange={onChange("email")}
                        disabled={!editing}
                        helperText={!editing ? "Edit mode required to change email." : ""}
                      />
                    </Grid>
                  </Grid>
                )}
              </CardContent>

              {!isPending && (
                <CardActions sx={{ justifyContent: "flex-end", px: 3, pb: 3 }}>
                  <Button variant="outlined" startIcon={<Key />} onClick={() => setPwOpen(true)}>
                    Change Password
                  </Button>
                </CardActions>
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="subtitle1" fontWeight={900} gutterBottom>
                Account Status
              </Typography>

              <Box
                display="grid"
                gridTemplateColumns={{ xs: "1fr", sm: "160px 1fr" }}
                rowGap={1.5}
                columnGap={2}
              >
                <Typography color="text.secondary">Member since</Typography>
                <Typography>{fmt(user?.createdAt)}</Typography>

                <Typography color="text.secondary">Last login</Typography>
                <Typography>{fmt(user?.lastLogin)}</Typography>

                <Typography color="text.secondary">Auth mode</Typography>
                <Typography>{user?.rememberMe ? "Persistent" : "Session"}</Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box display="flex" gap={1}>
                <Button fullWidth variant="outlined" onClick={() => refetch()}>
                  Refresh
                </Button>
                <Button
                  fullWidth
                  color="error"
                  variant="contained"
                  startIcon={<Delete />}
                  onClick={() => setDelOpen(true)}
                >
                  Delete Account
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Dialog open={pwOpen} onClose={() => setPwOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField
            label="Current Password"
            type="password"
            fullWidth
            margin="normal"
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
          />
          <TextField
            label="New Password"
            type="password"
            fullWidth
            margin="normal"
            value={pwForm.newPassword}
            onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            helperText="Use at least 8 characters with a mix of letters and numbers."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitPassword}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <Typography>
            This action is irreversible. Your account and related data will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess(null)}>
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile;
