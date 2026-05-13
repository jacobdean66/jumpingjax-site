import type { Metadata } from "next";

import { BookingPageClient } from "@/components/booking/BookingPageClient";

export const metadata: Metadata = {
  title: "Book a rental | Jumping Jax",
  description: "Complete your inflatable rental booking with Jumping Jax.",
};

export default function BookingPage() {
  return <BookingPageClient />;
}
