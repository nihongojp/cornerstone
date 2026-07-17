import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  useTheme,
  useMediaQuery,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Container,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getToken, clearToken, json } from "../services/api";

type Me = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

const Header = (): React.ReactElement => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const location = useLocation();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [learnAnchorEl, setLearnAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => getToken());

  const isAuthed = Boolean(authToken);

  const navButtons = useMemo(
    () => [
      { label: "Watch", path: "/watch" },
      { label: "Talk", path: "/talk" },
    ],
    []
  );

  const learnMenuItems = useMemo(
    () => [
      { label: "Dashboard", path: "/dashboard", icon: DashboardRoundedIcon },
      { label: "Lessons", path: "/new-lessons", icon: MenuBookRoundedIcon },
    ],
    []
  );

  const isLearnActive = learnMenuItems.some((item) => location.pathname === item.path);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    clearToken();
    setAuthToken(getToken());
    setMe(null);
    setAnchorEl(null);
    setDrawerOpen(false);
    navigate("/auth");
  };

  const initialsOf = (first?: string, last?: string) => {
    const a = (first?.[0] || "").toUpperCase();
    const b = (last?.[0] || "").toUpperCase();
    return (a + b) || "U";
  };

  // Load /me when token is present, and re-run whenever token changes
  useEffect(() => {
    const loadMe = async () => {
      const token = getToken();
      setAuthToken(token);

      if (!token) {
        setMe(null);
        return;
      }

      try {
        setLoadingMe(true);
        const data = await json<{ user?: Me } | Me>("/api/auth/me");
        setMe((data as any).user ?? (data as any));
      } catch {
        // token invalid/expired -> treat as logged out
        clearToken();
        setAuthToken(null);
        setMe(null);
      } finally {
        setLoadingMe(false);
      }
    };

    void loadMe();
  }, [authToken]);

  // LocalStorage "storage" event only fires across tabs, but keep it anyway
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "access_token") setAuthToken(getToken());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Ensure header refreshes auth state when tab becomes active
  useEffect(() => {
    const onFocus = () => setAuthToken(getToken());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        height: 64,
        minHeight: 64,
        bgcolor: "#fff",
        borderBottom: `1px solid ${theme.palette.divider}`,
        zIndex: 2000,
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 64,
          }}
        >
          <Box
            component={Link}
            to="/"
            sx={{
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="h6" fontWeight={900}>
              Nihon-Go!
            </Typography>
          </Box>

          {!isMobile && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {navButtons.map(({ label, path }) => (
                <Button
                  key={label}
                  component={Link}
                  to={path}
                  sx={{
                    fontWeight: isActive(path) ? 800 : 600,
                    color: isActive(path) ? "#b43d20" : "text.primary",
                  }}
                >
                  {label}
                </Button>
              ))}

              <Button
                onClick={(e) => setLearnAnchorEl(e.currentTarget)}
                endIcon={<KeyboardArrowDownRoundedIcon />}
                sx={{
                  fontWeight: isLearnActive ? 800 : 600,
                  color: isLearnActive ? "#b43d20" : "text.primary",
                }}
              >
                Learn
              </Button>

              <Menu
                anchorEl={learnAnchorEl}
                open={Boolean(learnAnchorEl)}
                onClose={() => setLearnAnchorEl(null)}
              >
                {learnMenuItems.map(({ label, path, icon: Icon }) => (
                  <MenuItem
                    key={label}
                    component={Link}
                    to={path}
                    onClick={() => setLearnAnchorEl(null)}
                    sx={{
                      fontWeight: isActive(path) ? 800 : 500,
                      color: isActive(path) ? "#b43d20" : "text.primary",
                    }}
                  >
                    <Icon fontSize="small" sx={{ mr: 1 }} /> {label}
                  </MenuItem>
                ))}
              </Menu>

              {!isAuthed ? (
                <Button
                  variant="contained"
                  onClick={() => navigate("/auth")}
                  sx={{ bgcolor: "#b43d20" }}
                >
                  Get Started
                </Button>
              ) : (
                <>
                  <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                    <Avatar sx={{ bgcolor: "#b43d20" }}>
                      {loadingMe ? (
                        <CircularProgress size={18} sx={{ color: "white" }} />
                      ) : (
                        initialsOf(me?.firstName, me?.lastName)
                      )}
                    </Avatar>
                  </IconButton>

                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => setAnchorEl(null)}
                  >
                    <MenuItem
                      component={Link}
                      to="/profile"
                      onClick={() => setAnchorEl(null)}
                    >
                      <PersonIcon fontSize="small" sx={{ mr: 1 }} /> Profile
                    </MenuItem>
                    <MenuItem onClick={handleLogout}>
                      <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Box>
          )}

          {isMobile && (
            <IconButton onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}

          <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          >
            <List>
              {navButtons.map(({ label, path }) => (
                <ListItemButton
                  key={label}
                  component={Link}
                  to={path}
                  onClick={() => setDrawerOpen(false)}
                >
                  <ListItemText primary={label} />
                </ListItemButton>
              ))}

              {learnMenuItems.map(({ label, path }) => (
                <ListItemButton
                  key={label}
                  component={Link}
                  to={path}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ pl: 3 }}
                >
                  <ListItemText primary={label} />
                </ListItemButton>
              ))}
            </List>

            <Box sx={{ px: 2, pb: 2 }}>
              {!isAuthed ? (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate("/auth");
                  }}
                  sx={{ bgcolor: "#b43d20" }}
                >
                  Get Started
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    setDrawerOpen(false);
                    handleLogout();
                  }}
                  startIcon={<LogoutIcon />}
                >
                  Logout
                </Button>
              )}
            </Box>
          </Drawer>
        </Box>
      </Container>
    </Box>
  );
};

export default Header;