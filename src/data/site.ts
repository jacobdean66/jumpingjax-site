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
  tagline: "Greenwood, SC Inflatable Rentals & Parties",
  description:
    "Inflatable rentals, bounce houses, water slides, foam parties, open play, and kids' birthday parties in Greenwood, South Carolina and nearby communities.",
  logo: "/logo.png",
};

// ============================================================================
// Contact Information
// ============================================================================

export const contact: ContactInfo = {
  phone: "864-933-1420",
  email: "info@jumpingjaxllc.com",
  address: "559 Beaudrot Rd, Greenwood, SC",
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
    "Honea Path",
    "Laurens",
    "Ninety Six",
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
    url: "https://www.facebook.com/p/Jumping-Jax-LLC-100057288707032/",
    icon: "facebook",
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/jumping.jax.llc/",
    icon: "instagram",
  },
];

// ============================================================================
// Navigation Links
// ============================================================================

export const navigationLinks: NavigationLink[] = [
  { label: "Home", href: "/" },
  { label: "Rentals", href: "/rentals" },
  { label: "Facility Parties", href: "/facility-parties" },
  { label: "Foam Parties", href: "/rentals/foam-parties" },
  { label: "Accessories", href: "/rentals/accessories" },
  { label: "Contact", href: "/contact" },
];

export const mobileNavigationLinks: NavigationLink[] = [
  ...navigationLinks,
  { label: "Phone", href: "tel:8649331420" },
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
      { label: "Foam Parties", href: "/rentals/foam-parties" },
      { label: "Accessories", href: "/rentals/accessories" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Rentals",
    links: [
      { label: "Bounce Houses", href: "/rentals/bounce-houses" },
      { label: "Combos", href: "/rentals/combos" },
      { label: "Inflatable Games", href: "/rentals/inflatable-games" },
      { label: "Obstacle Courses", href: "/rentals/obstacle-courses" },
      { label: "Slides", href: "/rentals/slides" },
      { label: "Water Slides", href: "/rentals/water-slides" },
      { label: "Foam Parties", href: "/rentals/foam-parties" },
      { label: "Accessories", href: "/rentals/accessories" },
      { label: "Yard Games", href: "/rentals/yard-games" },
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
  title: "Inflatable Rentals in Greenwood, SC | Jumping Jax",
  description:
    "Rent bounce houses, water slides, obstacle courses, foam parties, and party equipment from Jumping Jax in Greenwood, SC and nearby communities.",
  keywords: [
    "inflatable rentals",
    "party rentals",
    "water slide rentals",
    "event rentals",
    "South Carolina",
    "Greenwood",
  ],
  ogImage: "/logo.png",
};

// ============================================================================
// Page-Specific SEO
// ============================================================================

export const pageSEO = {
  home: {
    title: "Inflatable & Bounce House Rentals in Greenwood, SC | Jumping Jax",
    description:
      "Rent bounce houses, water slides, obstacle courses, foam parties, and party equipment from Jumping Jax in Greenwood, SC and nearby communities.",
  },
  rentals: {
    title: "Inflatable & Party Rentals in Greenwood, SC",
    description:
      "Browse bounce house rentals, water slides, combos, obstacle courses, inflatable games, and party equipment for Greenwood, SC and nearby communities.",
  },
  facilityParties: {
    title: "Kids' Birthday Party Venue in Greenwood, SC",
    description:
      "Plan an indoor kids' birthday party at Jumping Jax in Greenwood, SC, with party rooms, inflatable fun, and a simple online reservation request.",
  },
  contact: {
    title: "Contact Jumping Jax in Greenwood, SC",
    description:
      "Contact Jumping Jax about inflatable rentals, water slides, bounce houses, foam parties, and birthday parties in Greenwood, SC.",
  },
};

// ============================================================================
// Category Configuration
// ============================================================================

export const rentalCategories = [
  { id: "bounce-houses", label: "Bounce Houses", icon: "balloon" },
  { id: "combos", label: "Combos", icon: "layers" },
  { id: "inflatable-games", label: "Inflatable Games", icon: "gamepad2" },
  { id: "obstacle-courses", label: "Obstacle Courses", icon: "flag" },
  { id: "slides", label: "Slides", icon: "mountain" },
  { id: "water-slides", label: "Water Slides", icon: "waves" },
  { id: "foam-parties", label: "Foam Parties", icon: "bubbles" },
  { id: "accessories", label: "Accessories", icon: "package" },
  { id: "yard-games", label: "Yard Games", icon: "trophy" },
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
