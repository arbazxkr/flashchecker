import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API and WebSocket calls to Express backend during dev
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
