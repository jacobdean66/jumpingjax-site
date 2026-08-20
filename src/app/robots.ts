import type { MetadataRoute } from "next";
import { getSeoBaseUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSeoBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/booking",
          "/logistics",
          "/rentals/confirmation",
          "/facility-parties/confirmation",
          "/nominate",
          "/nominees",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
