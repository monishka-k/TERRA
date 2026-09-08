import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_INTERNAL_URL || "https://the-dead-zone.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
