import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

export const PHONEME_SAMPLE_RATE = 16000;

/**
 * Decodes an arbitrary audio buffer (webm/opus, mp3, mp4, ogg, wav, ...) into
 * mono 16kHz 32-bit float PCM samples, the input format wav2vec2's feature
 * extractor expects. ffmpeg-static bundles its own binary, so this needs no
 * system ffmpeg install.
 */
export function decodeToPcm16k(input: Buffer): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary not available (ffmpeg-static)"));
      return;
    }

    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-f", "f32le",
      "-acodec", "pcm_f32le",
      "-ac", "1",
      "-ar", String(PHONEME_SAMPLE_RATE),
      "pipe:1",
    ];

    const proc = spawn(ffmpegPath, args);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    proc.on("error", (err) => reject(err));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${Buffer.concat(stderrChunks).toString("utf8")}`));
        return;
      }
      const raw = Buffer.concat(stdoutChunks);
      const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
      // Copy out of the shared Buffer's ArrayBuffer before it can be pooled/reused.
      resolve(new Float32Array(samples));
    });

    proc.stdin.on("error", () => {
      // Ignore EPIPE if ffmpeg exits early (e.g. malformed input) — the
      // "close" handler above reports the real failure.
    });
    proc.stdin.write(input);
    proc.stdin.end();
  });
}
