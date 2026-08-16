"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import Bart from '../components/Menut';

const Talk = (): React.ReactElement => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const lastResult = event.results?.[event.resultIndex];
        if (lastResult?.isFinal) {
          setTranscript((prev) =>
            prev ? `${prev} ${lastResult[0].transcript}` : lastResult[0].transcript
          );
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startRecording = async () => {
    try {
      setTranscript('');
      isRecordingRef.current = true;
      setIsRecording(true);

      recognitionRef.current?.start();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ac = new AudioContext();
      audioContextRef.current = ac;

      const src = ac.createMediaStreamSource(stream);
      sourceRef.current = src;

      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      analyserRef.current = analyser;

      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      draw();
    } catch (error) {
      console.error('Error starting recording:', error);
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);

    try {
      recognitionRef.current?.stop();
    } catch {}

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;

    analyserRef.current = null;
    sourceRef.current = null;
    dataArrayRef.current = null;
  };

  const draw = () => {
    if (!analyserRef.current || !canvasRef.current || !dataArrayRef.current) return;

    const drawWaveform = () => {
      if (
        !isRecordingRef.current ||
        !analyserRef.current ||
        !canvasRef.current ||
        !dataArrayRef.current
      ) {
        return;
      }

      analyserRef.current.getByteTimeDomainData(
        dataArrayRef.current
      );

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#ff6b6b');
      gradient.addColorStop(0.5, '#feca57');
      gradient.addColorStop(1, '#48dbfb');

      ctx.lineWidth = 4;
      ctx.strokeStyle = gradient;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff6b6b';
      ctx.beginPath();

      const data = dataArrayRef.current;
      const sliceWidth = canvas.width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128.0;
        const y = canvas.height / 2 + v * 80;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      if (isRecordingRef.current) {
        requestAnimationFrame(drawWaveform);
      }
    };

    requestAnimationFrame(drawWaveform);
  };

  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <Bart />

      <Box
        component="main"
        flexGrow={1}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        textAlign="center"
        px={3}
        sx={{ backgroundColor: '#dee2e4' }}
      >
        <Typography variant="h3" mb={3}>
          Talk Page
        </Typography>

        <Typography variant="h6" mb={4}>
          Speak and see your words magically appear!
        </Typography>

        <Box sx={{ width: '100%', maxWidth: 600, mb: 3 }}>
          <canvas
            ref={canvasRef}
            width={600}
            height={100}
            style={{
              width: '100%',
              height: 'auto',
              backgroundColor: 'white',
              borderRadius: '8px',
              display: 'block',
            }}
          />
        </Box>

        <Button
          variant="contained"
          color={isRecording ? 'secondary' : 'primary'}
          onClick={isRecording ? stopRecording : startRecording}
          sx={{ mb: 4 }}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Button>

        <Box
          bgcolor="#f5f5f5"
          p={3}
          borderRadius={4}
          width={{ xs: '95%', sm: '80%' }}
          minHeight="100px"
          textAlign="left"
          mb={5}
          overflow="auto"
        >
          <Typography variant="body1">
            {transcript || 'Your spoken text will appear here...'}
          </Typography>
        </Box>

        <Button variant="outlined" color="primary" href="/dashboard">
          Back to Dashboard
        </Button>
      </Box>
    </Box>
  );
};

export default Talk;