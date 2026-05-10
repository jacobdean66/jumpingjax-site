/**
 * Centralized Site Configuration
 * Contains all business, contact, and navigation constants for the Jumping Jax website
 * Strongly typed for type safety and easier maintenance
 */

// ============================================================================
// Types
// ============================================================================

export interface BusinessInfo {
  name: string;
  tagline: string;
  description: string;
  logo?: string;
}

export interface ContactInfo {
  phone: string;
  email: string;
  address?: string;
}

export interface LocationInfo {
  city: string;
  state: string;
  serviceAreas: string[];
  country?: string;
}

export interface BusinessHours {
  day: string;
  hours: string;
  closed?: boolean;
}

export interface SocialLink {
  name: string;
  url: string;
  icon?: string;
}

export interface NavigationLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface SEODefaults {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  twitterHandle?: string;
}

export interface FooterSection {
  title: string;
  links: NavigationLink[];
}

// ============================================================================
// Business Information
// ============================================================================

export const business: BusinessInfo = {
  name: "Jumping Jax",
  tagline: "South Carolina Inflatable Rentals",
  description:
    "Premium inflatable rental services for parties, events, and celebrations across South Carolina",
  logo: "/logo.png",
};

// ============================================================================
// Contact Information
// ============================================================================

export const contact: ContactInfo = {
  phone: "(864) 555-JUMP",
  email: "info@jumpingjax.com",
  address: "Greenwood, SC",
};

// ============================================================================
// Location Information
// ============================================================================

export const location: LocationInfo = {
  city: "Greenwood",
  state: "South Carolina",
  country: "USA",
  serviceAreas: [
    "Greenwood",
    "Clinton",
    "Abbeville",
    "Edgefield",
    "Saluda",
    "McCormick",
  ],
};

// ============================================================================
// Business Hours
// ============================================================================

export const businessHours: BusinessHours[] = [
  { day: "Monday", hours: "9:00 AM - 6:00 PM" },
  { day: "Tuesday", hours: "9:00 AM - 6:00 PM" },
  { day: "Wednesday", hours: "9:00 AM - 6:00 PM" },
  { day: "Thursday", hours: "9:00 AM - 6:00 PM" },
  { day: "Friday", hours: "9:00 AM - 6:00 PM" },
  { day: "Saturday", hours: "8:00 AM - 5:00 PM" },
  { day: "Sunday", hours: "Closed", closed: true },
];

// ============================================================================
// Social Media Links
// ============================================================================

export const socialLinks: SocialLink[] = [
  {
    name: "Facebook",
    url: "https://facebook.com/jumpingjax",
    icon: "facebook",
  },
  {
    name: "Instagram",
    url: "https://instagram.com/jumpingjax",
    icon: "instagram",
  },
  {
    name: "YouTube",
    url: "https://youtube.com/jumpingjax",
    icon: "youtube",
  },
];

// ============================================================================
// Navigation Links
// ============================================================================

export const navigationLinks: NavigationLink[] = [
  { label: "Home", href: "/" },
  { label: "Rentals", href: "/rentals" },
  { label: "Facility Parties", href: "/facility-parties" },
  { label: "Contact", href: "/contact" },
];

export const mobileNavigationLinks: NavigationLink[] = [
  ...navigationLinks,
  { label: "Phone", href: "tel:(864) 555-JUMP" },
];

// ============================================================================
// Footer Links
// ============================================================================

export const footerSections: FooterSection[] = [
  {
    title: "Quick Links",
    links: [
      { label: "Home", href: "/" },
      { label: "Rentals", href: "/rentals" },
      { label: "Facility Parties", href: "/facility-parties" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Rentals",
    links: [
      { label: "Water Slides", href: "/rentals?category=water-slides" },
      { label: "Games", href: "/rentals?category=games" },
      { label: "Inflatables", href: "/rentals?category=inflatables" },
      { label: "Party Rentals", href: "/party-rentals" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cancellation Policy", href: "/cancellation" },
    ],
  },
];

// ============================================================================
// SEO Defaults
// ============================================================================

export const seoDefaults: SEODefaults = {
  title: "Jumping Jax - South Carolina Inflatable Rentals",
  description:
    "Premier inflatable rental services for parties, events, and celebrations in South Carolina. Water slides, games, and more for unforgettable events.",
  keywords: [
    "inflatable rentals",
    "party rentals",
    "water slide rentals",
    "event rentals",
    "South Carolina",
    "Greenwood",
  ],
  ogImage: "/og-image.jpg",
  twitterHandle: "@jumpingjax",
};

// ============================================================================
// Page-Specific SEO
// ============================================================================

export const pageSEO = {
  home: {
    title: "Jumping Jax - Inflatable Rentals & Party Planning",
    description:
      "Rent inflatables, water slides, games, and more for your next party or event in South Carolina.",
  },
  rentals: {
    title: "Inflatable & Party Rentals - Jumping Jax",
    description:
      "Browse our selection of water slides, games, inflatables, and party equipment available for rent.",
  },
  facilityParties: {
    title: "Facility Parties - Jumping Jax",
    description:
      "Host your party at our facility with our all-inclusive party packages in Greenwood, South Carolina.",
  },
  contact: {
    title: "Contact Jumping Jax",
    description:
      "Get in touch with Jumping Jax for all your inflatable rental and event planning needs.",
  },
};

// ============================================================================
// Category Configuration
// ============================================================================

export const rentalCategories = [
  { id: "water-slides", label: "Water Slides", icon: "waves" },
  { id: "games", label: "Games", icon: "gamepad2" },
  { id: "inflatables", label: "Inflatables", icon: "balloon" },
  { id: "party-rentals", label: "Party Rentals", icon: "party-popper" },
];

// ============================================================================
// Feature Flags / Configuration
// ============================================================================

export const features = {
  enableBooking: true,
  enableFacilityRentals: true,
  enableBlog: false,
  enableGallery: true,
  enableLiveChat: false,
};
