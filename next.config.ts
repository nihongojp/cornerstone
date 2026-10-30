import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy route kept from the CRA app (client/src/App.tsx).
      { source: "/charinfo", destination: "/gallery", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        /*
         * The service worker must never be served from HTTP cache: a stale
         * worker keeps serving stale assets and the only fix is the learner
         * clearing site data. `Service-Worker-Allowed` is belt-and-braces —
         * the file already sits at the root scope.
         */
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

/*
 * withPayload adds the `serverExternalPackages` Payload needs (graphql, the
 * drizzle/postgres adapter, pino, sharp, ...) and the Turbopack settings that
 * let the admin compile. It merges into the config above rather than replacing
 * it, so the /charinfo redirect and everything else is preserved.
 */
export default withPayload(nextConfig);
