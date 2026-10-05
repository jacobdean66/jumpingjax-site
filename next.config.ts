import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/facility/invitations/themes/*": ["./public/invitation-library/**/*.png"],
  },
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
      ...["/rental-agreement/:path*", "/api/rental-agreement/:path*"].map(source => ({
        source,
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      })),
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
        statusCode: 301,
      },
      {
        source: "/category/waterslides",
        destination: "/rentals/water-slides",
        statusCode: 301,
      },
      ...["bounce-houses", "combos", "inflatable-games", "obstacle-courses", "slides", "water-slides", "foam-parties", "yard-games", "accessories"].map((category) => ({
        source: `/category/${category}/:path*`,
        destination: `/rentals/${category}`,
        permanent: true,
      })),
      {
        source: "/pages/obstacle-course-rentals-in-ware-shoals-sc",
        destination: "/rentals/obstacle-courses",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
