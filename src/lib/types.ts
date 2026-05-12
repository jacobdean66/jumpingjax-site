export type RentalItem = {
  id: string;
  name: string;
  slug: string;
  category: string;

  price: number;
  
  // Legacy image field (main display image)
  image: string;
  
  // New image fields for scaling
  heroImage?: string; // Distinct hero image if different from main
  galleryImages?: string[]; // Array of images for detail page gallery

  description: string;

  features: string[];

  capacity?: number;

  available: boolean;
  
  // Future-proofing fields
  seoSlug?: string; // SEO-optimized slug alternative
  pricing?: {
    basePrice: number;
    currency?: string;
    customPricing?: Record<string, number>; // For different rental durations, etc.
  };
  availability?: {
    status: "available" | "limited" | "unavailable";
    nextAvailableDate?: string;
    blackoutDates?: string[];
  };
};

export type FacilityPartyPackage = {
  id: string;

  name: string;

  price: number;

  durationHours: number;

  guestLimit: number;

  description: string;

  features: string[];

  available: boolean;
};

// Booking Types
export type BookingStatus =
  | "pending"
  | "approved"
  | "denied"
  | "cancelled";

export type RentalBooking = {
  id: string;

  rentalId: string;

  customerName: string;

  customerPhone: string;

  customerEmail?: string;

  eventDate: string;

  deliveryAddress: string;

  notes?: string;

  status: BookingStatus;

  createdAt: string;
};

export type FacilityPartyBooking = {
  id: string;

  packageId: string;

  customerName: string;

  customerPhone: string;

  customerEmail?: string;

  partyDate: string;

  timeSlot: string;

  guestCount: number;

  notes?: string;

  status: BookingStatus;

  createdAt: string;
};