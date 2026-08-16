import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy route kept from the CRA app (client/src/App.tsx).
      { source: "/charinfo", destination: "/gallery", permanent: false },
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
