"use client";
import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Box, Button } from '@mui/material';
import Bart from '@/components/Menut';
import { getCharacterById } from '@/data/characters';

const RouterLink = Link;

const CharInfo: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const char = slug ? getCharacterById(slug) : undefined;

  if (!char) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          backgroundColor: '#dee2e4',
          minHeight: '100vh',
          padding: '20px 12px',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        <Box sx={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
          <Bart />
        </Box>
        <h2>Character not found</h2>
        <Button variant="outlined" component={RouterLink} href="/gallery">
          Back to Gallery
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        textAlign: 'center',
        backgroundColor: '#dee2e4',
        minHeight: '100vh',
        padding: { xs: '20px 12px', sm: '20px 24px' },
        position: 'relative',
        fontFamily: 'sans-serif',
      }}
    >
      <Box sx={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <Bart />
      </Box>

      <h2>Gallery</h2>

      {/* FIX: was flexDirection:'row' with fixed img width:300 and caption width:'min(680px,30vw)'.
          On mobile 30vw ≈ 90px — far too narrow to read. Now stacks vertically on small screens. */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'center',
          alignItems: { xs: 'center', md: 'flex-start' },
          gap: { xs: 2, md: '24px' },
          marginTop: '20px',
        }}
      >
        {/* Character image */}
        <Box>
          <Box
            sx={{
              height: { xs: 240, sm: '48vh' },
              maxHeight: 420,
              width: { xs: '80vw', sm: 300 },
              maxWidth: 300,
              backgroundColor: '#d3d3d3',
              borderRadius: '30px',
              mx: 'auto',
            }}
          />
          <p
            style={{
              fontSize: '18px',
              lineHeight: 1.5,
              fontWeight: 100,
              marginTop: 16,
              textAlign: 'left',
            }}
          >
            Met: {char.met}
          </p>
        </Box>

        {/* Character info — FIX: was width:'min(680px,30vw)' → ~90px on phones */}
        <Box
          sx={{
            textAlign: 'left',
            padding: '20px',
            width: { xs: '90vw', sm: '80vw', md: 'min(680px, 45vw)' },
            maxWidth: 680,
            borderRadius: '16px',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{char.name}</h3>
          <p style={{ fontSize: '18px', lineHeight: 1.5, fontWeight: 100, margin: 0 }}>
            {char.description}
          </p>

          <h3 style={{ marginTop: 16 }}>Abilities</h3>
          {char.abilities.map((ab, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <h4 style={{ margin: '10px 20px' }}>{ab.name}</h4>
              <p style={{ fontSize: '18px', lineHeight: 1.5, fontWeight: 100, margin: '10px 20px' }}>
                {ab.effect}
              </p>
            </div>
          ))}
        </Box>
      </Box>

      <Box sx={{ marginTop: 3, textAlign: 'center' }}>
        <Button
          variant="outlined"
          component={RouterLink}
          href="/gallery"
          sx={{
            backgroundColor: '#92a6ba',
            fontSize: '16px',
            height: '50px',
            width: { xs: '80vw', sm: '200px' },
            color: '#000',
            borderColor: '#92a6ba',
            textTransform: 'none',
            '&:hover': { backgroundColor: '#7a92a8', borderColor: '#7a92a8' },
          }}
        >
          Back to Gallery
        </Button>
      </Box>
    </Box>
  );
};

export default CharInfo;
