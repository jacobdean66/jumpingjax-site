import type { MetadataRoute } from "next";
import { getSeoBaseUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSeoBaseUrl();
  // Bot-specific groups do not inherit '*': keep private paths identical.
  const privatePaths = [
    "/admin", "/api", "/booking", "/logistics", "/driver",
    "/check-in", "/facility-party-check-in", "/payments", "/waiver",
    "/rental-agreement", "/facility-party-agreement",
    "/rentals/confirmation", "/facility-parties/confirmation",
    "/facility-parties/invitations", "/facility-parties/guest-list",
    "/nominate", "/nominees",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
