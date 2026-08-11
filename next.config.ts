import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy route kept from the CRA app (client/src/App.tsx).
      { source: "/charinfo", destination: "/gallery", permanent: false },
    ];
  },
};

export default nextConfig;
