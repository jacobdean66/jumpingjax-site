import { z } from "zod";
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

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ rental?: string; date?: string }> }) {
  const [query, rentals] = await Promise.all([searchParams, loadWebsiteRentals()]);
  const draft = rentals.find(rental => rental.slug === query.rental);
  const date = z.iso.date().safeParse(query.date);
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [year, month] = today.split("-").map(Number);
  const lastDate = new Date(Date.UTC(year, month + 6, 0)).toISOString().slice(0, 10);
  const draftDate = date.success && date.data >= today && date.data <= lastDate ? date.data : undefined;
  return <BookingPageClient rentals={rentals} draftRentalId={draft?.slug} draftDate={draft ? draftDate : undefined} />;
}
