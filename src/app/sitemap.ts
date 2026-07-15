import type { MetadataRoute } from "next";
import {
  CATEGORY_IDS,
  RENTALS,
  rentalDetailPath,
} from "@/data/rentals";
import { absoluteSeoUrl } from "@/lib/seo/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    "/",
    "/rentals",
    "/facility-parties",
    "/contact",
    ...CATEGORY_IDS.map((category) => `/rentals/${category}`),
    ...RENTALS.map((rental) => rentalDetailPath(rental)),
  ];

  return staticRoutes.map((route) => ({
    url: absoluteSeoUrl(route),
    lastModified: now,
    changeFrequency:
      route === "/" || route === "/rentals" ? "weekly" : "monthly",
    priority:
      route === "/"
        ? 1
        : route === "/rentals" || route === "/facility-parties"
          ? 0.9
          : route.startsWith("/rentals/")
            ? 0.75
            : 0.6,
  }));
}
