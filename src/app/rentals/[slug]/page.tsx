import { notFound } from "next/navigation";
import { Metadata } from "next";
import { rentals } from "@/data/rentals";
import { generateMetadata as generatePageMetadata, getCanonicalUrl } from "@/lib/metadata";
import RentalDetailHero from "@/components/rental-detail/RentalDetailHero";
import RentalFeatures from "@/components/rental-detail/RentalFeatures";
import RentalBookingCTA from "@/components/rental-detail/RentalBookingCTA";
import RentalGallery from "@/components/rental-detail/RentalGallery";
import RentalCard from "@/components/RentalCard";
import Link from "next/link";

interface RentalDetailPageProps {
  params: {
    slug: string;
  };
}

// Generate static parameters for all rentals
export async function generateStaticParams() {
  return rentals.map((rental) => ({
    slug: rental.slug,
  }));
}

// Generate dynamic metadata for each rental
export async function generateMetadata(
  { params }: RentalDetailPageProps
): Promise<Metadata> {
  const rental = rentals.find((r) => r.slug === params.slug);

  if (!rental) {
    return generatePageMetadata({
      title: "Rental Not Found",
      description: "The rental you're looking for could not be found.",
      noindex: true,
    });
  }

  return generatePageMetadata({
    title: `${rental.name} - Inflatable Rental | Jumping Jax`,
    description: `Rent ${rental.name} for your event. ${rental.description} Starting at $${rental.price}.`,
    keywords: [
      rental.name,
      "inflatable rental",
      "party rental",
      "event rental",
      rental.category,
      "South Carolina",
    ],
    ogImage: rental.image,
    canonicalUrl: getCanonicalUrl(`/rentals/${rental.slug}`),
  });
}

export default function RentalDetailPage({ params }: RentalDetailPageProps) {
  const rental = rentals.find((r) => r.slug === params.slug);

  // If rental not found, return 404
  if (!rental) {
    notFound();
  }

  // Get related rentals (same category, excluding current)
  const relatedRentals = rentals.filter(
    (r) => r.category === rental.category && r.id !== rental.id
  );

  return (
    <main className="min-h-screen bg-[#071326] text-white">
      {/* Hero Section */}
      <RentalDetailHero rental={rental} />

      {/* Features Section */}
      <RentalFeatures rental={rental} />

      {/* Booking CTA */}
      <RentalBookingCTA rental={rental} />

      {/* Gallery Section */}
      <RentalGallery rental={rental} />

      {/* Related Rentals */}
      {relatedRentals.length > 0 && (
        <section className="border-t border-white/10 px-4 py-14 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-balance text-3xl font-black tracking-tight text-white md:text-5xl">
              Similar Rentals
            </h2>

            <p className="mb-8 max-w-2xl text-base leading-7 text-slate-400 md:mb-10 md:text-lg">
              Explore other inflatables in the same category
            </p>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedRentals.map((relatedRental) => (
                <RentalCard
                  key={relatedRental.id}
                  rentalId={relatedRental.slug}
                  title={relatedRental.name}
                  price={relatedRental.price}
                  image={relatedRental.image}
                  description={relatedRental.description}
                  slug={relatedRental.slug}
                  category={relatedRental.category}
                  dimensions={relatedRental.dimensions}
                  features={relatedRental.features}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back to Rentals Link */}
      <section className="border-t border-white/10 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/rentals"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-5 py-2 text-sm font-bold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-white/10 hover:text-white"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Back to All Rentals</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
