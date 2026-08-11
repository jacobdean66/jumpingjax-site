import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.7.161"],
  images: {
    qualities: [70, 75, 78, 82],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "agoqprldqphqrlotopau.supabase.co",
        pathname: "/storage/v1/object/public/rental-inventory-images/**",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
