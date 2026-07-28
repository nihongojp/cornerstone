import React, { useEffect, useRef, useState } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";

type RecordState = "idle" | "recording" | "recorded" | "playing";

const btnSx = (active: boolean, recording = false) => ({
  width: 40,
  height: 40,
  bgcolor: recording ? "#DC2626" : active ? "rgba(180,61,32,0.08)" : "#fff",
  color: recording || active ? (recording ? "#fff" : "#B43D20") : "#B43D20",
  border: recording ? "none" : "2px solid #B43D20",
  "&:hover": {
    bgcolor: recording ? "#B91C1C" : "rgba(180,61,32,0.12)",
  },
  transition: "all 0.2s",
  animation: recording ? "selfRecordPulse 1.2s ease-in-out infinite" : "none",
  "@keyframes selfRecordPulse": {
    "0%, 100%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.45)" },
    "50%": { boxShadow: "0 0 0 6px rgba(220,38,38,0)" },
  },
});

function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

/**
 * Compact mic control for the drag-and-drop audio row: record → stop →
 * replay / re-record. Cleans up MediaRecorder, mic tracks, and object URLs.
 */
const SelfRecordButton: React.FC = () => {
  const [state, setState] = useState<RecordState>("idle");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const clearPlaybackUrl = () => {
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      } catch {
        /* ignore */
      }
      playbackAudioRef.current?.pause();
      stopTracks();
      clearPlaybackUrl();
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    playbackAudioRef.current?.pause();
    clearPlaybackUrl();
    blobRef.current = null;

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording isn’t supported here");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        blobRef.current = blob;
        clearPlaybackUrl();
        playbackUrlRef.current = URL.createObjectURL(blob);
        stopTracks();
        setState("recorded");
      };

      recorder.start();
      setState("recording");
    } catch {
      stopTracks();
      setError("Mic permission denied");
      setState("idle");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  };

  const playRecording = () => {
    if (!playbackUrlRef.current) return;
    playbackAudioRef.current?.pause();
    const audio = new Audio(playbackUrlRef.current);
    playbackAudioRef.current = audio;
    audio.onended = () => setState("recorded");
    audio.onerror = () => setState("recorded");
    setState("playing");
    audio.play().catch(() => setState("recorded"));
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {(state === "idle" || state === "recording") && (
          <Tooltip title={state === "recording" ? "Stop" : "Record yourself"}>
            <IconButton
              aria-label={state === "recording" ? "Stop recording" : "Start recording"}
              onClick={state === "recording" ? stopRecording : startRecording}
              sx={btnSx(false, state === "recording")}
            >
              {state === "recording" ? <StopRoundedIcon fontSize="small" /> : <MicRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}

        {(state === "recorded" || state === "playing") && (
          <>
            <Tooltip title="Play your recording">
              <IconButton
                aria-label="Play your recording"
                onClick={playRecording}
                disabled={state === "playing"}
                sx={btnSx(state === "playing")}
              >
                <PlayArrowRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Re-record">
              <IconButton aria-label="Re-record" onClick={startRecording} sx={btnSx(false)}>
                <MicRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {error ? (
        <Typography variant="caption" sx={{ color: "#DC2626", fontWeight: 600, maxWidth: 120, textAlign: "center" }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
};

export default SelfRecordButton;
