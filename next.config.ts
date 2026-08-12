import type { NextConfig } from "next";

/**
 * Inventory photos upload to Supabase Storage. Without these remotePatterns,
 * next/image returns INVALID_IMAGE_OPTIMIZE_REQUEST and public cards show a
 * dark placeholder even though the file is saved.
 */
function supabaseStorageRemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const patterns: NonNullable<
    NonNullable<NextConfig["images"]>["remotePatterns"]
  > = [];
  const seen = new Set<string>();
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Production project hostname fallback so uploads keep rendering even if
    // the build env is missing NEXT_PUBLIC_SUPABASE_URL.
    "https://agoqprldqphqrlotopau.supabase.co",
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    try {
      const hostname = new URL(candidate).hostname;
      if (!hostname || seen.has(hostname)) continue;
      seen.add(hostname);
      patterns.push({
        protocol: "https",
        hostname,
        pathname: "/storage/v1/object/public/**",
      });
    } catch {
      // Ignore malformed env values; fallback hostname still applies.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.7.161"],
  images: {
    // Qualities used across rental cards / detail / homepage.
    qualities: [70, 72, 74, 75, 78, 82],
    remotePatterns: supabaseStorageRemotePatterns(),
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
