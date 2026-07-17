import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Link, useNavigate } from "react-router-dom";

import { listNewLessons, NewLessonListItem } from "../services/newLessons";

const NewLessonsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<NewLessonListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await listNewLessons();
        if (mounted) setLessons(data);
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F9F7F4" }}>
      <Container maxWidth="md" sx={{ pt: 5, pb: 8 }}>
        {/* Page title */}
        <Box sx={{ mb: 4 }}>
          <Typography
            sx={{ fontWeight: 900, fontSize: { xs: "1.6rem", sm: "2rem" }, letterSpacing: "-0.02em", color: "#1C1917" }}
          >
            New Lessons ✨
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Select a lesson to begin
          </Typography>
        </Box>

        {/* Loading */}
        {loading && (
          <Stack alignItems="center" gap={2} sx={{ pt: 6 }}>
            <CircularProgress sx={{ color: "#B43D20" }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Loading lessons…
            </Typography>
          </Stack>
        )}

        {/* Error */}
        {!loading && error && (
          <Paper
            elevation={0}
            sx={{ p: 4, borderRadius: 4, border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}
          >
            <Typography variant="h5" sx={{ mb: 1 }}>⚠️</Typography>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Could not load lessons</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
              Make sure the server is running and try again.
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.reload()}
              sx={{ bgcolor: "#B43D20", "&:hover": { bgcolor: "#9D351C" }, borderRadius: 999, fontWeight: 700 }}
            >
              Retry
            </Button>
          </Paper>
        )}

        {/* Empty */}
        {!loading && !error && lessons.length === 0 && (
          <Paper
            elevation={0}
            sx={{ p: 4, borderRadius: 4, border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}
          >
            <Typography variant="h5" sx={{ mb: 1 }}>📭</Typography>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>No lessons available yet</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Check back soon — lessons are being added.
            </Typography>
          </Paper>
        )}

        {/* Lesson cards */}
        {!loading && !error && lessons.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {lessons.map((lesson) => (
              <Paper
                key={lesson._id}
                component={Link}
                to={`/newlesson/${lesson.slug}`}
                elevation={0}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 3,
                  borderRadius: "16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  bgcolor: "#fff",
                  textDecoration: "none",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 6px 24px rgba(0,0,0,0.1)",
                    "& .arrow": { opacity: 1, transform: "translateX(0)" },
                  },
                }}
              >
                <Box>
                  <Typography
                    sx={{ fontWeight: 800, fontSize: "1.05rem", color: "#1C1917", lineHeight: 1.3 }}
                  >
                    {lesson.lesson}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {lesson.slug}
                  </Typography>
                </Box>

                <ArrowForwardRoundedIcon
                  className="arrow"
                  sx={{
                    color: "#B43D20",
                    opacity: 0,
                    transform: "translateX(-4px)",
                    transition: "opacity 0.15s, transform 0.15s",
                    flexShrink: 0,
                    ml: 2,
                  }}
                />
              </Paper>
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default NewLessonsListPage;
