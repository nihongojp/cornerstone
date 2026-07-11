// src/App.tsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Box } from "@mui/material";

import Home       from "./pages/Home";
import Dashboard  from "./pages/Dashboard";
import Lesson     from "./pages/Lesson";
import Watch      from "./pages/Watch";
import Talk       from "./pages/Talk";
import AuthForm   from "./pages/AuthForm";
import Resources  from "./pages/Resources";
import FunFacts   from "./pages/FunFacts";
import Gallery    from "./pages/Gallery";
import Stories    from "./pages/Stories";
import CharInfo   from "./pages/CharInfo";
import Profile    from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import NewLessonPage from "./pages/NewLessonPage";
import NewLessonsListPage from "./pages/NewLessonsListPage";

import Header from "./components/Header";
import Footer from "./components/Footer";

import { getToken } from "./services/api";

// ── Auth helpers ──────────────────────────────────────────────────────────────
const isAuthed = () => Boolean(getToken());

// ── Route guards ──────────────────────────────────────────────────────────────
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const location = useLocation();
  if (!isAuthed()) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }
  return children;
};

const PublicOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  if (isAuthed()) return <Navigate to="/dashboard" replace />;
  return children;
};

// ── Scroll restoration ────────────────────────────────────────────────────────
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
};

// ── Layout ────────────────────────────────────────────────────────────────────
const AppContent: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  const hideHeader = path.startsWith("/lesson") || path.startsWith("/newlesson");
  const hideFooter = path.startsWith("/lesson") || path.startsWith("/newlesson") || path === "/dashboard";

  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <ScrollToTop />

      {!hideHeader && (
        /*
         * Sticky wrapper
         * ─────────────
         * position: sticky + top: 0 keeps the header at the top of the
         * viewport as the user scrolls without removing it from the document
         * flow (unlike position: fixed which would overlap page content).
         *
         * zIndex: 1100 sits above MUI Drawer (1200) siblings but below
         * Modal / Tooltip (1300+), matching MUI's own AppBar convention.
         *
         * The "floating" look comes from MUI AppBar's default box-shadow
         * (elevation 4). We neutralise it here with boxShadow: "none" and
         * replace it with a hairline borderBottom so the header reads as
         * attached to the page rather than hovering above it.
         *
         * px: { xs: 1, sm: 2 } + the inner maxWidth container give the
         * header breathing room from the viewport edges ("gaps around the
         * corners") without needing to change the Header component itself.
         */
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1100,
            // Background + border replace the floating shadow
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            // Kill whatever elevation/shadow MUI AppBar adds internally
            "& .MuiAppBar-root": {
              position: "static",   // override AppBar's own position so it
                                    // doesn't fight the sticky wrapper
              boxShadow: "none",
              bgcolor: "transparent",
            },
            // Side breathing room — content doesn't slam into viewport edges
            px: { xs: 1, sm: 2, md: 3 },
          }}
        >
          <Header />
        </Box>
      )}

      <Box component="main" flexGrow={1}>
        <Routes>
          {/* Public */}
          <Route path="/"                element={<Home />} />
          <Route path="/funfacts"        element={<FunFacts />} />
          <Route path="/resources"       element={<Resources />} />
          <Route path="/gallery"         element={<Gallery />} />
          <Route path="/stories"         element={<Stories />} />
          <Route path="/characters/:id"  element={<CharInfo />} />
          <Route path="/charinfo"        element={<Navigate to="/gallery" replace />} />

          {/* Public-only */}
          <Route path="/auth"             element={<PublicOnly><AuthForm /></PublicOnly>} />
          <Route path="/login"            element={<PublicOnly><AuthForm /></PublicOnly>} />
          <Route path="/signup"           element={<PublicOnly><AuthForm /></PublicOnly>} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />

          {/* Protected */}
          <Route path="/dashboard"         element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/lesson/:lessonId"  element={<RequireAuth><Lesson /></RequireAuth>} />
          <Route path="/newlesson/:slug"   element={<RequireAuth><NewLessonPage /></RequireAuth>} />
          <Route path="/new-lessons"       element={<RequireAuth><NewLessonsListPage /></RequireAuth>} />
          <Route path="/watch"             element={<RequireAuth><Watch /></RequireAuth>} />
          <Route path="/talk"              element={<RequireAuth><Talk /></RequireAuth>} />
          <Route path="/profile"           element={<RequireAuth><Profile /></RequireAuth>} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>

      {!hideFooter && <Footer />}
    </Box>
  );
};

const App: React.FC = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;