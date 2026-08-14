import type { MetadataRoute } from "next";
import { NextResponse } from "next/server";

const manifest: MetadataRoute.Manifest = {
  id: "/admin/check-in",
  name: "Jumping Jax Waivers",
  short_name: "Jax Waivers",
  description:
    "Jumping Jax waiver search, Open Play check-in, attendance, and reporting.",
  start_url: "/admin/check-in",
  scope: "/admin/",
  display: "standalone",
  background_color: "#f8fafc",
  theme_color: "#047857",
  orientation: "any",
  categories: ["business", "productivity"],
  icons: [
    {
      src: "/icon",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icon",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
  shortcuts: [
    {
      name: "Check-in",
      short_name: "Check-in",
      description: "Search waivers and check in Open Play guests.",
      url: "/admin/check-in",
    },
    {
      name: "Who's Here",
      short_name: "Who's Here",
      description: "See today's checked-in guests.",
      url: "/admin/whos-here",
    },
    {
      name: "Daily Report",
      short_name: "Report",
      description: "Open today's waiver and admissions report.",
      url: "/admin/open-play-report",
    },
  ],
};

export function GET() {
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/manifest+json",
    },
  });
}
