"use client";

import React from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  Divider,
  Stack,
} from "@mui/material";
import Link from "next/link";

// FIX: Footer links now point only to routes that actually exist in App.tsx.
// Placeholder links (Donate, Mobile App, etc.) are marked and can be uncommented
// once those pages are built.
const footerLinks: { label: string; to: string }[] = [
  { label: "Gallery", to: "/gallery" },
  { label: "Stories", to: "/stories" },
  { label: "Fun Facts", to: "/funfacts" },
  { label: "Resources", to: "/resources" },
  { label: "Watch", to: "/watch" },
  { label: "Talk", to: "/talk" },
  // Uncomment when pages exist:
  // { label: "About Us", to: "/about" },
  // { label: "Donate", to: "/donate" },
  // { label: "FAQs", to: "/faqs" },
  // { label: "Help Center", to: "/help" },
  // { label: "Contact", to: "/contact" },
  // { label: "Mobile App", to: "/mobile" },
];

const Footer = (): React.ReactElement => {
  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        bgcolor: "background.paper",
        borderTop: "1px solid rgba(0,0,0,0.10)",
        overflowX: "hidden",
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Box sx={{ py: { xs: 4, sm: 5 } }}>
          {/* Top row */}
          <Box
            sx={{
              display: "flex",
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 2,
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                fontWeight={900}
                sx={{ letterSpacing: "-0.02em" }}
              >
                Nihon-Go!
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
                Learn Japanese in a fun, effective, and cultural way.
              </Typography>
            </Box>

            <Button
              variant="contained"
              sx={{
                textTransform: "none",
                bgcolor: "#b43d20",
                fontWeight: 900,
                borderRadius: 2,
                px: 2.5,
                minHeight: 44,
                "&:hover": { bgcolor: "#9f341b" },
                width: { xs: "100%", sm: "auto" },
              }}
              component={Link}
              href="/auth"
            >
              Get Started
            </Button>
          </Box>

          <Divider sx={{ my: { xs: 3, sm: 3.5 } }} />

          {/* Links */}
          <Stack
            direction="row"
            useFlexGap
            flexWrap="wrap"
            spacing={1}
            sx={{
              justifyContent: { xs: "center", sm: "flex-start" },
              rowGap: 1,
              overflowX: "hidden",
            }}
          >
            {footerLinks.map((x) => (
              <Button
                key={x.label}
                component={Link}
                href={x.to}
                size="small"
                sx={{
                  textTransform: "none",
                  fontWeight: 800,
                  borderRadius: 999,
                  px: 1.25,
                  "&:hover": { bgcolor: "rgba(180,61,32,0.06)" },
                }}
              >
                {x.label}
              </Button>
            ))}
          </Stack>

          <Divider sx={{ my: { xs: 3, sm: 3.5 } }} />

          {/* Bottom row */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.5,
              textAlign: { xs: "center", sm: "left" },
            }}
          >
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              © 2025 Nihon-Go! All Rights Reserved
            </Typography>

            <Typography variant="body2" sx={{ opacity: 0.65 }}>
              Built with ❤️ for curious learners
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
