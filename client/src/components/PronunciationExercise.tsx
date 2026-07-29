import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Chip, Typography } from "@mui/material";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

/**
 * Grammar / vocab pronunciation practice item.
 *
 * MongoDB Compass fields (on a `pronunciationExercise` item):
 * - `phrase`      — term / short label (always used as fallback transcript)
 * - `transcript`  — optional longer transcript text shown under the video
 * - `videoUrl`    — optional practice video (separate from reference audio)
 * - `audioUrl`    — dedicated reference audio clip (NOT the video's audio track)
 *
 * Hand-authored items keyed by `phrase` are reused at expand time (like
 * dragAndDrop), so Compass edits survive checkpoint regeneration.
 */
export type PronunciationExerciseData = {
  type: "pronunciationExercise";
  number: number;
  phrase: string;
  /** Dedicated reference audio — do not derive from video. */
  audioUrl?: string;
  /** Optional practice video shown above the transcript. */
  videoUrl?: string;
  /** Optional transcript; falls back to `phrase` when omitted. */
  transcript?: string;
};

type RecordingState = "idle" | "recording" | "recorded" | "playing";

interface Props {
  exercise: PronunciationExerciseData;
  onRecordingComplete?: (blob: Blob) => void;
}

const BRAND = "#B43D20";

function isPlaceholderUrl(url?: string): boolean {
  return !url || url.toUpperCase().includes("PLACEHOLDER");
}

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

const PronunciationExercise: React.FC<Props> = ({ exercise, onRecordingComplete }) => {
  const { number, phrase, audioUrl, videoUrl, transcript } = exercise;
  const displayTranscript = (transcript?.trim() || phrase || "").trim();

  const [recordState, setRecordState] = useState<RecordingState>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [refPlaying, setRefPlaying] = useState(false);

  const refAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingBlobRef = useRef<Blob | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // When true, reference `onended` should continue into the user recording.
  const chainToRecordingRef = useRef(false);

  const hasRef = !isPlaceholderUrl(audioUrl);
  const hasVideo = !isPlaceholderUrl(videoUrl);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const playUserRecording = useCallback(() => {
    if (!playbackUrlRef.current || !playbackAudioRef.current) {
      setRecordState("recorded");
      return;
    }
    const a = playbackAudioRef.current;
    a.src = playbackUrlRef.current;
    a.currentTime = 0;
    setRecordState("playing");
    a.play().catch(() => setRecordState("recorded"));
  }, []);

  // ── Reference audio only ───────────────────────────────────────────────────
  const playReference = useCallback(() => {
    if (!hasRef || !refAudioRef.current) return;
    chainToRecordingRef.current = false;
    // Don't let a chained compare continue if the user taps reference alone.
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
    }
    const a = refAudioRef.current;
    a.currentTime = 0;
    setRefPlaying(true);
    a.play().catch(() => {
      setRefPlaying(false);
      setAudioUnavailable(true);
    });
  }, [hasRef]);

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setMicError(null);
    chainToRecordingRef.current = false;
    refAudioRef.current?.pause();
    setRefPlaying(false);

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("Microphone access was denied. Please allow microphone access and try again.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      recordingBlobRef.current = blob;

      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = URL.createObjectURL(blob);

      onRecordingComplete?.(blob);
      setRecordState("recorded");
    };

    recorder.start();
    setRecordState("recording");
  }, [onRecordingComplete]);

  // ── Stop recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  // ── Compare: reference audio, then user recording seamlessly ───────────────
  const playCompare = useCallback(() => {
    if (!playbackUrlRef.current) return;

    // Stop any in-flight playback first.
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
    }

    if (hasRef && refAudioRef.current && !audioUnavailable) {
      chainToRecordingRef.current = true;
      const a = refAudioRef.current;
      a.currentTime = 0;
      setRefPlaying(true);
      setRecordState("playing");
      a.play().catch(() => {
        // Reference failed — still play the user recording.
        chainToRecordingRef.current = false;
        setRefPlaying(false);
        setAudioUnavailable(true);
        playUserRecording();
      });
      return;
    }

    // No reference audio — play the recording alone.
    chainToRecordingRef.current = false;
    playUserRecording();
  }, [hasRef, audioUnavailable, playUserRecording]);

  // ── Rerecord ───────────────────────────────────────────────────────────────
  const rerecord = useCallback(() => {
    chainToRecordingRef.current = false;
    refAudioRef.current?.pause();
    setRefPlaying(false);
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.src = "";
    }
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
    recordingBlobRef.current = null;
    setRecordState("idle");
    // Immediately begin a new recording per the state machine
    void startRecording();
  }, [startRecording]);

  // ── Playback ended ─────────────────────────────────────────────────────────
  const handlePlaybackEnded = useCallback(() => setRecordState("recorded"), []);

  const handleRefEnded = useCallback(() => {
    setRefPlaying(false);
    if (chainToRecordingRef.current) {
      chainToRecordingRef.current = false;
      // Start user recording immediately — no intentional gap beyond the
      // browser's natural audio handoff.
      playUserRecording();
    }
  }, [playUserRecording]);

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 560,
        mx: "auto",
        px: { xs: 1, sm: 2 },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      {/* Exercise number badge */}
      <Chip
        label={`Exercise ${number}`}
        size="small"
        sx={{ fontWeight: 700, fontSize: "0.72rem", bgcolor: "rgba(180,61,32,0.08)", color: BRAND }}
      />

      {/* Video (when present) */}
      {hasVideo && (
        <Box
          sx={{
            width: "100%",
            aspectRatio: "16/9",
            borderRadius: "16px",
            overflow: "hidden",
            bgcolor: "#000",
          }}
        >
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </Box>
      )}

      {/* Transcript */}
      <Box textAlign="center" sx={{ width: "100%" }}>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: displayTranscript.length > 80 ? "1rem" : "1.25rem",
            color: "#1C1917",
            lineHeight: 1.45,
            letterSpacing: "-0.01em",
            whiteSpace: "pre-wrap",
          }}
        >
          {displayTranscript}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75 }}>
          Listen, then record your pronunciation
        </Typography>
      </Box>

      {/* Hidden audio elements — reference is a dedicated clip, never the video track */}
      {hasRef && (
        <audio
          ref={refAudioRef}
          src={audioUrl}
          preload="auto"
          onEnded={handleRefEnded}
          onError={() => {
            setAudioUnavailable(true);
            setRefPlaying(false);
            if (chainToRecordingRef.current) {
              chainToRecordingRef.current = false;
              playUserRecording();
            }
          }}
        />
      )}
      <audio ref={playbackAudioRef} onEnded={handlePlaybackEnded} />

      {/* Reference audio button */}
      <Box
        component="button"
        aria-label="Play reference audio"
        disabled={!hasRef || audioUnavailable || refPlaying || recordState === "playing"}
        onClick={playReference}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          px: 3,
          py: 1.5,
          borderRadius: "14px",
          border: `2px solid ${(!hasRef || audioUnavailable) ? "rgba(0,0,0,0.12)" : refPlaying ? BRAND : "rgba(180,61,32,0.3)"}`,
          bgcolor: refPlaying ? "rgba(180,61,32,0.08)" : "rgba(180,61,32,0.04)",
          cursor: (!hasRef || audioUnavailable || refPlaying || recordState === "playing") ? "default" : "pointer",
          transition: "all 0.2s",
          background: "none",
          "&:hover:not(:disabled)": { bgcolor: "rgba(180,61,32,0.1)", borderColor: BRAND },
          "&:disabled": { opacity: 0.45 },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            bgcolor: (!hasRef || audioUnavailable) ? "rgba(0,0,0,0.1)" : BRAND,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {refPlaying
            ? <GraphicEqRoundedIcon sx={{ color: "#fff", fontSize: "1.3rem" }} />
            : <VolumeUpRoundedIcon sx={{ color: "#fff", fontSize: "1.3rem" }} />}
        </Box>

        <Typography sx={{ fontWeight: 700, fontSize: "0.78rem", color: (!hasRef || audioUnavailable) ? "text.disabled" : BRAND }}>
          {(!hasRef || audioUnavailable)
            ? "No reference audio"
            : refPlaying
              ? "Playing…"
              : "Play reference"}
        </Typography>
      </Box>

      {/* Mic permission error */}
      {micError && (
        <Box
          role="alert"
          sx={{
            width: "100%",
            px: 2.5,
            py: 1.5,
            borderRadius: "12px",
            bgcolor: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
          }}
        >
          <Typography sx={{ fontSize: "0.85rem", color: "#DC2626", fontWeight: 600 }}>
            🎙 {micError}
          </Typography>
        </Box>
      )}

      {/* Recording controls */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>

        {/* Record / Stop */}
        {(recordState === "idle" || recordState === "recording") && (
          <Button
            variant="contained"
            aria-label={recordState === "recording" ? "Stop recording" : "Start recording"}
            startIcon={recordState === "recording" ? <StopRoundedIcon /> : <MicRoundedIcon />}
            onClick={recordState === "recording" ? stopRecording : startRecording}
            sx={{
              borderRadius: 999,
              fontWeight: 700,
              px: 3,
              bgcolor: recordState === "recording" ? "#DC2626" : BRAND,
              "&:hover": { bgcolor: recordState === "recording" ? "#B91C1C" : "#9D351C" },
              animation: recordState === "recording" ? "micPulse 1.4s ease-in-out infinite" : "none",
              "@keyframes micPulse": {
                "0%,100%": { boxShadow: `0 0 0 0 rgba(220,38,38,0.5)` },
                "50%": { boxShadow: `0 0 0 10px rgba(220,38,38,0)` },
              },
            }}
          >
            {recordState === "recording" ? "Stop recording" : "Start recording"}
          </Button>
        )}

        {/* Playback: reference first, then user recording */}
        {(recordState === "recorded" || recordState === "playing") && (
          <Button
            variant="contained"
            aria-label="Play reference then your recording"
            startIcon={<PlayArrowRoundedIcon />}
            disabled={recordState === "playing"}
            onClick={playCompare}
            sx={{
              borderRadius: 999,
              fontWeight: 700,
              px: 3,
              bgcolor: BRAND,
              "&:hover": { bgcolor: "#9D351C" },
            }}
          >
            {recordState === "playing"
              ? (refPlaying ? "Reference…" : "Your recording…")
              : hasRef && !audioUnavailable
                ? "Play reference + yours"
                : "Play your recording"}
          </Button>
        )}

        {/* Rerecord */}
        {(recordState === "recorded" || recordState === "playing") && (
          <Button
            variant="outlined"
            aria-label="Record again"
            startIcon={<ReplayRoundedIcon />}
            disabled={recordState === "playing"}
            onClick={rerecord}
            sx={{
              borderRadius: 999,
              fontWeight: 700,
              px: 2.5,
              borderColor: "rgba(0,0,0,0.2)",
              color: "text.secondary",
              "&:hover": { borderColor: BRAND, color: BRAND },
            }}
          >
            Record again
          </Button>
        )}
      </Box>

      {/* State hint */}
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {recordState === "idle" && "Press Start recording when you're ready"}
        {recordState === "recording" && "🔴 Recording — press Stop when finished"}
        {recordState === "recorded" && (
          hasRef && !audioUnavailable
            ? "✓ Recording saved — play reference then yours, or record again"
            : "✓ Recording saved — play it back or record again"
        )}
        {recordState === "playing" && (
          refPlaying
            ? "▶ Playing reference audio…"
            : "▶ Playing back your recording…"
        )}
      </Typography>
    </Box>
  );
};

export default PronunciationExercise;
