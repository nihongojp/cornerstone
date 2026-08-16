"use client";

import React, { useMemo, useState } from "react";
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
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "../lib/auth-client";

const Header = (): React.ReactElement => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const pathname = usePathname();
  const router = useRouter();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: session, isPending: loadingMe } = useSession();
  const me = session?.user ?? null;
  const isAuthed = Boolean(session);

  const navButtons = useMemo(
    () => [
      { label: "Watch", path: "/watch" },
      { label: "Talk", path: "/talk" },
    ],
    []
  );

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    setAnchorEl(null);
    setDrawerOpen(false);
    await signOut();
    router.push("/auth");
    router.refresh();
  };

  const initialsOf = (first?: string | null, last?: string | null) => {
    const a = (first?.[0] || "").toUpperCase();
    const b = (last?.[0] || "").toUpperCase();
    return a + b || "U";
  };

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
            href="/"
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
                  href={path}
                  sx={{
                    fontWeight: isActive(path) ? 800 : 600,
                    color: isActive(path) ? "#b43d20" : "text.primary",
                  }}
                >
                  {label}
                </Button>
              ))}

              <Button
                component={Link}
                href="/new-lessons"
                sx={{
                  fontWeight: isActive("/new-lessons") ? 800 : 600,
                  color: isActive("/new-lessons") ? "#b43d20" : "text.primary",
                }}
              >
                Learn
              </Button>

              {!isAuthed ? (
                <Button
                  variant="contained"
                  onClick={() => router.push("/auth")}
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
                      href="/profile"
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
                  href={path}
                  onClick={() => setDrawerOpen(false)}
                >
                  <ListItemText primary={label} />
                </ListItemButton>
              ))}

              <ListItemButton
                component={Link}
                href="/new-lessons"
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemText primary="Learn" />
              </ListItemButton>
            </List>

            <Box sx={{ px: 2, pb: 2 }}>
              {!isAuthed ? (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    setDrawerOpen(false);
                    router.push("/auth");
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
                  onClick={handleLogout}
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
