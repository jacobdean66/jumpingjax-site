import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "Jumping Jax Operations",
    short_name: "Jumping Jax",
    description: "Jumping Jax booking, scheduling, and operations dashboard.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#fff8e8",
    theme_color: "#0f1f3d",
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
  };
}
