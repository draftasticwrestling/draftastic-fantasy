import type { NextConfig } from "next";

function supabaseStorageHostname(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (u) {
    try {
      return new URL(u).hostname;
    } catch {
      /* fall through */
    }
  }
  return "qvbqxietcmweltxoonvh.supabase.co";
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseStorageHostname(),
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/score", destination: "/event-results", permanent: true },
      { source: "/results/:eventId", destination: "/event-results/:eventId", permanent: true },
      { source: "/admin/articles", destination: "/internal-admin/articles", permanent: false },
      { source: "/admin/articles/:path*", destination: "/internal-admin/articles/:path*", permanent: false },
      { source: "/admin/draft-testing", destination: "/internal-admin/draft-testing", permanent: false },
      { source: "/admin/draft-testing/:path*", destination: "/internal-admin/draft-testing/:path*", permanent: false },
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
