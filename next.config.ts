import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/score", destination: "/event-results", permanent: true },
      { source: "/results/:eventId", destination: "/event-results/:eventId", permanent: true },
    ];
  },
};

export default nextConfig;
