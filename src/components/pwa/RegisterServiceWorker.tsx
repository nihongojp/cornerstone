"use client";

import { useEffect } from "react";

/*
 * Registers public/sw.js once per page load, production only.
 *
 * Dev is excluded because a worker that survives `next dev` restarts serves
 * stale chunks and turns every HMR mystery into a cache mystery. If you need
 * to test the worker locally, run `next build && next start` (HTTPS is not
 * required on localhost).
 *
 * `updateViaCache: "none"` makes the browser re-fetch sw.js on every
 * navigation check instead of trusting HTTP cache, and next.config.ts serves
 * it with no-store for the same reason — a stale worker is the one PWA bug
 * that users can't fix by refreshing.
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => {
        // Not fatal: the site works without a worker. Log so a broken sw.js
        // is visible in Vercel's browser logs rather than silently absent.
        console.error("[pwa] service worker registration failed", err);
      });
  }, []);

  return null;
}
