import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.7.161"],
  images: {
    qualities: [70, 72, 74, 75, 78, 82],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "agoqprldqphqrlotopau.supabase.co",
        pathname: "/storage/v1/object/public/rental-inventory-images/**",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/v1/create-qr-code/**",
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
  async redirects() {
    return [
      {
        source: "/pages/water-slide-rentals-in-greenwood-sc",
        destination: "/rentals/water-slides",
        permanent: true,
      },
      {
        source: "/category/waterslides",
        destination: "/rentals/water-slides",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
