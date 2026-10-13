/**
 * SEO and Metadata Utilities for Next.js App Router
 * Provides reusable metadata generators using centralized site configuration
 */

import { Metadata } from "next";
import {
  business,
  contact,
  location,
  seoDefaults,
  pageSEO,
  type BusinessHours,
} from "@/data/site";
import { absoluteSeoUrl, getSeoBaseUrl } from "@/lib/seo/site-url";

// ============================================================================
// Types
// ============================================================================

export interface MetadataOptions {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  canonicalUrl?: string;
  noindex?: boolean;
  nofollow?: boolean;
}

export interface PageMetadataOptions extends MetadataOptions {
  alternates?: {
    canonical?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OG_IMAGE = seoDefaults.ogImage || "/logo.png";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate canonical URL for a page
 */
export const getCanonicalUrl = (path: string = ""): string => {
  return absoluteSeoUrl(path || "/");
};

/**
 * Generate complete OG image URL
 */
export const getOgImageUrl = (imagePath?: string): string => {
  const image = imagePath || DEFAULT_OG_IMAGE;
  if (image.startsWith("http")) return image;
  return absoluteSeoUrl(image);
};

/**
 * Generate complete metadata object for a page
 */
export const generateMetadata = (
  options: MetadataOptions = {}
): Metadata => {
  const {
    title = seoDefaults.title,
    description = seoDefaults.description,
    keywords = seoDefaults.keywords,
    ogImage = DEFAULT_OG_IMAGE,
    ogType = "website",
    twitterCard = "summary_large_image",
    canonicalUrl,
    noindex = false,
    nofollow = false,
  } = options;

  const ogImageUrl = getOgImageUrl(ogImage);

  const robots: Record<string, boolean | string> = {};
  if (noindex) robots.index = false;
  if (nofollow) robots.follow = false;

  return {
    title,
    description,
    keywords: keywords
      ? typeof keywords === "string"
        ? [keywords]
        : keywords
      : undefined,
    robots:
      Object.keys(robots).length > 0
        ? (robots as Record<string, string | boolean>)
        : undefined,
    openGraph: {
      type: ogType,
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${business.name} - ${business.tagline}`,
        },
      ],
      siteName: business.name,
      url: canonicalUrl || getCanonicalUrl(),
    },
    twitter: {
      card: twitterCard,
      title,
      description,
      images: [ogImageUrl],
      creator: seoDefaults.twitterHandle || undefined,
      site: seoDefaults.twitterHandle || undefined,
    },
    alternates: {
      canonical: canonicalUrl || getCanonicalUrl(),
    },
  };
};

// ============================================================================
// Page-Specific Metadata Generators
// ============================================================================

/**
 * Generate metadata for the home page
 */
export const generateHomeMetadata = (): Metadata => {
  return generateMetadata({
    title: pageSEO.home.title,
    description: pageSEO.home.description,
    canonicalUrl: getCanonicalUrl("/"),
    ogType: "website",
    keywords: [
      "inflatable rentals",
      "party rentals",
      "water slide rentals",
      "Greenwood SC",
      "event rentals",
    ],
  });
};

/**
 * Generate metadata for the rentals page
 */
export const generateRentalsMetadata = (): Metadata => {
  return generateMetadata({
    title: pageSEO.rentals.title,
    description: pageSEO.rentals.description,
    canonicalUrl: getCanonicalUrl("/rentals"),
    ogType: "website",
    keywords: [
      "water slide rentals",
      "bounce house rentals",
      "inflatable rentals",
      "party equipment",
      "Greenwood SC rentals",
      ...location.serviceAreas.map((area) => `${area} rentals`),
    ],
  });
};

/**
 * Generate metadata for the facility parties page
 */
export const generateFacilityPartiesMetadata = (): Metadata => {
  return generateMetadata({
    title: pageSEO.facilityParties.title,
    description: pageSEO.facilityParties.description,
    canonicalUrl: getCanonicalUrl("/facility-parties"),
    ogType: "website",
    keywords: [
      "kids birthday party places Greenwood SC",
      "indoor birthday party places near me",
      "birthday party venue Greenwood SC",
      "indoor playground Greenwood SC",
    ],
  });
};

/**
 * Generate metadata for the contact page
 */
export const generateContactMetadata = (): Metadata => {
  return generateMetadata({
    title: pageSEO.contact.title,
    description: pageSEO.contact.description,
    canonicalUrl: getCanonicalUrl("/contact"),
    ogType: "website",
    keywords: ["contact Jumping Jax", "inquiries", "booking", "Greenwood SC"],
  });
};

// ============================================================================
// Structured Data / Schema.org Helpers
// ============================================================================

/**
 * Generate JSON-LD schema for organization
 */
export const generateOrganizationSchema = (settings?: {
  businessHours: BusinessHours[];
  websiteText: { contactPhone: string; contactEmail: string; contactAddress: string; businessDescription: string };
}) => {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "EntertainmentBusiness"],
    "@id": `${getSeoBaseUrl()}/#business`,
    name: business.name,
    description: settings?.websiteText.businessDescription ?? business.description,
    image: absoluteSeoUrl(business.logo || "/logo.png"),
    telephone: settings?.websiteText.contactPhone ?? contact.phone,
    email: settings?.websiteText.contactEmail ?? contact.email,
    address: !settings || settings.websiteText.contactAddress === contact.address ? {
      "@type": "PostalAddress",
      streetAddress: "559 Beaudrot Rd",
      addressLocality: location.city,
      addressRegion: "SC",
      postalCode: "29649",
      addressCountry: "US",
    } : settings.websiteText.contactAddress,
    openingHoursSpecification: settings ? openingHoursFromDisplay(settings.businessHours) : undefined,
    areaServed: location.serviceAreas.map((name) => ({
      "@type": "City",
      name: `${name}, SC`,
    })),
    url: getSeoBaseUrl(),
    sameAs: [
      "https://www.facebook.com/p/Jumping-Jax-LLC-100057288707032/",
      "https://www.instagram.com/jumping.jax.llc/",
    ],
  };
};

/**
 * Generate JSON-LD schema for business hours
 */
export function openingHoursFromDisplay(rows: readonly BusinessHours[]) {
  const days = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
  const time = (hour: string, minute: string, period: string) => {
    const h = Number(hour);
    const m = Number(minute);
    if (h < 1 || h > 12 || m > 59) return null;
    return `${String(h % 12 + (period.toUpperCase() === "PM" ? 12 : 0)).padStart(2, "0")}:${minute}`;
  };
  return rows.flatMap(row => {
    if (row.closed || !days.has(row.day)) return [];
    const match = row.hours.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return []; // Appointment-only or ambiguous text is not a timed opening.
    const opens = time(match[1], match[2], match[3]);
    const closes = time(match[4], match[5], match[6]);
    if (!opens || !closes || opens >= closes) return [];
    return [{ "@type": "OpeningHoursSpecification", dayOfWeek: row.day, opens, closes }];
  });
}

export const generateBusinessHoursSchema = (rows: readonly BusinessHours[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${getSeoBaseUrl()}/#business`,
    name: business.name,
    openingHoursSpecification: openingHoursFromDisplay(rows),
  };
};

export const generateServiceSchema = (
  name: string,
  description: string,
  path: string,
  serviceType: string,
  scope: "delivery" | "facility" = "delivery",
) => {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteSeoUrl(path)}#service`,
    name,
    description,
    serviceType,
    provider: {
      "@id": `${getSeoBaseUrl()}/#business`,
      name: business.name,
    },
    areaServed: (scope === "facility" ? [location.city] : location.serviceAreas).map((name) => ({
      "@type": "City",
      name: `${name}, SC`,
    })),
    url: absoluteSeoUrl(path),
  };
};

export const generateBreadcrumbSchema = (
  items: { name: string; path: string }[],
) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteSeoUrl(item.path),
    })),
  };
};

export const generateItemListSchema = (
  name: string,
  description: string,
  path: string,
  items: { name: string; path: string; image?: string }[],
) => {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteSeoUrl(path)}#itemlist`,
    name,
    description,
    url: absoluteSeoUrl(path),
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteSeoUrl(item.path),
      item: {
        // Lists link to detail pages; only detail pages describe priced Products.
        "@type": "Thing",
        name: item.name,
        url: absoluteSeoUrl(item.path),
        image: item.image ? getOgImageUrl(item.image) : undefined,
      },
    })),
  };
};

/**
 * Generate JSON-LD schema for a rental product
 */
export const generateProductSchema = (
  productName: string,
  description: string,
  price?: number,
  image?: string,
  path?: string,
  category?: string,
) => {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": path ? `${absoluteSeoUrl(path)}#product` : undefined,
    name: productName,
    description,
    category,
    url: path ? absoluteSeoUrl(path) : undefined,
    image: image ? getOgImageUrl(image) : undefined,
    offers: typeof price === "number" && Number.isFinite(price) && price >= 0
      ? {
          "@type": "Offer",
          priceCurrency: "USD",
          price: price.toString(),
          url: path ? absoluteSeoUrl(path) : undefined,
          seller: {
            "@id": `${getSeoBaseUrl()}/#business`,
            name: business.name,
          },
        }
      : undefined,
    brand: {
      "@type": "Brand",
      name: business.name,
    },
  };
};

/**
 * Inject JSON-LD script into page head
 */
export const createJsonLdScript = (data: unknown) => {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
};
