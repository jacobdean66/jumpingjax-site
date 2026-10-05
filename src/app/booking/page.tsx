import type { Metadata } from "next";

import { BookingPageClient } from "@/components/booking/BookingPageClient";
import { loadWebsiteRentals } from "@/lib/rentals/public-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book an Inflatable Rental in Greenwood, SC",
  description:
    "Request your Jumping Jax inflatable rental date in Greenwood, SC, review your selected equipment, and send the event details for confirmation.",
  alternates: {
    canonical: "/booking",
  },
  openGraph: {
    title: "Book an Inflatable Rental in Greenwood, SC | Jumping Jax",
    description:
      "Request your Jumping Jax inflatable rental date and send the event details for confirmation.",
    url: "/booking",
    type: "website",
  },
};

export default async function BookingPage() {
  return <BookingPageClient rentals={await loadWebsiteRentals()} />;
}
