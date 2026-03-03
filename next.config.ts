import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/score", destination: "/event-results", permanent: true },
      { source: "/results/:eventId", destination: "/event-results/:eventId", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/_next/static/chunks/:path(.+\\.css)",
        headers: [{ key: "Content-Type", value: "text/css" }],
      },
    ];
  },
};

export default nextConfig;
