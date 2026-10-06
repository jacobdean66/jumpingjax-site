import type { MetadataRoute } from "next";
import {
  CATEGORY_IDS,
  rentalDetailPath,
} from "@/data/rentals";
import { absoluteSeoUrl } from "@/lib/seo/site-url";
import { loadWebsiteRentals } from "@/lib/rentals/public-catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rentals = await loadWebsiteRentals();
  const staticRoutes = [
    "/",
    "/rentals",
    "/facility-parties",
    "/contact",
    "/privacy",
    "/data-deletion",
    "/ads",
    ...CATEGORY_IDS.map((category) => `/rentals/${category}`),
    ...rentals.map((rental) => rentalDetailPath(rental)),
  ];

  return staticRoutes.map((route) => ({
    url: absoluteSeoUrl(route),
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
