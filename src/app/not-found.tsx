import type { Metadata } from "next";
import { BrandedErrorState } from "@/components/BrandedErrorState";

export const metadata: Metadata = {
  title: "Page Not Available",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <BrandedErrorState
      eyebrow="Page Not Found"
      title="We’re Sorry — This Page Isn’t Available"
      description="We may be updating this page, or the link may have changed. Please return to the Jumping Jax homepage and try again. For immediate help with a party, rental, or existing booking, contact us below."
      actions={[
        { href: "/", label: "Return to Home", emphasis: "primary" },
        { href: "/rentals", label: "View Inflatable Rentals" },
        { href: "/facility-parties", label: "View Facility Parties" },
      ]}
    />
  );
}
