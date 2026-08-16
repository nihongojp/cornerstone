"use client";
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Stack,
  Container,
  Card,
  CardActionArea,
} from '@mui/material';
import Bart from '../components/Menut';

const Stories = (): React.ReactElement => {
  return (
    <Box sx={{ backgroundColor: '#dee2e4', minHeight: '100vh', position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <Bart />
      </Box>

      <Container maxWidth="lg" sx={{ pt: { xs: 6, sm: 7 }, pb: { xs: 6, md: 8 } }}>

        <Typography
          variant="h4"
          sx={{
            textAlign: { xs: 'center', sm: 'left' },
            fontSize: { xs: '1.25rem', md: '2rem' },
            mb: { xs: 2, md: 3 },
            px: { xs: 0, sm: 1 },
          }}
        >
          All Stories
        </Typography>

        <Grid
          container
          spacing={{ xs: 2, sm: 3 }}
          sx={{ justifyContent: 'center', px: { xs: 0, sm: 1 } }}
        >
          {['#92a6ba', '#505c68', '#505c68', '#505c68'].map((bg, i) => (
            <Grid key={i} item xs={6} sm={4} md={3}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 10,
                  bgcolor: bg,
                  height: { xs: 140, sm: 160, md: 180 },
                  mx: 'auto',
                }}
              >
                <CardActionArea
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label={`Open story ${i + 1}`}
                >
                  {bg === '#505c68' && (
                    <Box
                      component="img"
                      src="assets/Lock.png"
                      alt="Locked"
                      sx={{ width: '45%', maxWidth: 100, opacity: 0.9 }}
                    />
                  )}
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box
          component="hr"
          sx={{
            width: { xs: '82%', md: '60%' },
            border: 0,
            borderTop: '1.5px solid #000',
            my: { xs: 4, md: 6 },
            mx: 'auto',
          }}
        />

        <Typography
          variant="h4"
          sx={{
            textAlign: { xs: 'center', sm: 'left' },
            fontSize: { xs: '1.25rem', md: '2rem' },
            mb: { xs: 2, md: 3 },
            px: { xs: 0, sm: 1 },
          }}
        >
          UNIT 1: MOMOTARO
        </Typography>

        {/* FIX: was a Stack with hard-coded width:'30vw' children that broke on mobile.
            Replaced with a responsive Grid so cards stack on small screens. */}
        <Grid container spacing={3} alignItems="stretch">

          {/* Left story card */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                backgroundColor: '#9fb1c4',
                borderRadius: '28px',
                p: { xs: 2.5, sm: 4 },
                display: 'flex',
                gap: 3,
                alignItems: 'center',
                height: '100%',
                minHeight: 200,
              }}
            >
              {/* Peach image */}
              <Box
                sx={{
                  width: { xs: 100, sm: 140, md: 160 },
                  height: { xs: 100, sm: 140, md: 160 },
                  borderRadius: '20px',
                  backgroundColor: '#e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <img src="assets/Peach.png" alt="Momotaro" style={{ height: '70%' }} />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 600 }}>
                  Momotaro
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ mt: 1.5, mb: 2, color: '#1e1e1e', fontWeight: 100, lineHeight: 1.6 }}
                >
                  Read about the adventure of Momotaro and his mission to defeat the oni!
                </Typography>

                {/* FIX: was width:"14vw" with paddingLeft:"-5vw" (invalid negative padding).
                    Now uses auto width and proper flex alignment. */}
                <Button
                  sx={{
                    borderRadius: '999px',
                    backgroundColor: '#d3d3d3',
                    fontSize: { xs: '0.9rem', sm: '1.1rem' },
                    fontWeight: 600,
                    textTransform: 'none',
                    color: '#1e1e1e',
                    px: 3,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    '&:hover': { backgroundColor: '#c0c0c0' },
                  }}
                >
                  Read
                  <Box
                    component="img"
                    src="assets/Blue Arrow.png"
                    alt="arrow"
                    sx={{ height: '22px' }}
                  />
                </Button>
              </Box>
            </Box>
          </Grid>

          {/* Right mini cards */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2} sx={{ height: '100%' }}>
              <Box
                sx={{
                  backgroundColor: '#e1e1e1',
                  borderRadius: '22px',
                  p: 2.5,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800 }}>
                    Review Vocabulary
                  </Typography>
                  <img src="assets/Blue Arrow.png" alt="arrow" style={{ height: '26px' }} />
                </Stack>
                <Box sx={{ mt: 1.5 }}>
                  <Box
                    sx={{
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: '#cfcfcf',
                      overflow: 'hidden',
                    }}
                  >
                    <Box sx={{ width: '0%', height: '100%', backgroundColor: '#7aa0c4' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', mt: 0.5 }}>0%</Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  backgroundColor: '#e1e1e1',
                  borderRadius: '22px',
                  p: 2.5,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800 }}>
                    Learn Grammar
                  </Typography>
                  <img src="assets/Blue Arrow.png" alt="arrow" style={{ height: '26px' }} />
                </Stack>
                <Box sx={{ mt: 1.5 }}>
                  <Box
                    sx={{
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: '#cfcfcf',
                      overflow: 'hidden',
                    }}
                  >
                    <Box sx={{ width: '0%', height: '100%', backgroundColor: '#7aa0c4' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', mt: 0.5 }}>0%</Typography>
                </Box>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        {/* Learn button — FIX: was width:"18vw" which is ~70px on mobile */}
        <Box sx={{ mt: 4, display: 'flex', justifyContent: { xs: 'center', md: 'flex-end' } }}>
          <Button
            sx={{
              borderRadius: '999px',
              backgroundColor: '#92a6ba',
              fontSize: { xs: '1.2rem', sm: '1.5rem' },
              fontWeight: 400,
              textTransform: 'none',
              color: '#1e1e1e',
              px: { xs: 4, sm: 6 },
              py: { xs: 1.5, sm: 2 },
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              '&:hover': { backgroundColor: '#8da3b8' },
            }}
          >
            Learn!
            <img src="assets/Arrow.png" alt="arrow" style={{ height: '26px' }} />
          </Button>
        </Box>

      </Container>
    </Box>
  );
};

export default Stories;
