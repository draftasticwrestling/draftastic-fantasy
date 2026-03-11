import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qvbqxietcmweltxoonvh.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
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
