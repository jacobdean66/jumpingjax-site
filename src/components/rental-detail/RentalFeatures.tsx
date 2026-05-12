import { RentalItem } from "@/lib/types";
import { Check } from "lucide-react";

interface RentalFeaturesProps {
  rental: RentalItem;
}

export default function RentalFeatures({ rental }: RentalFeaturesProps) {
  return (
    <section className="px-4 py-16 md:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-2 lg:gap-16">
          {/* Specifications */}
          <div>
            <h2 className="mb-8 text-3xl md:text-4xl font-bold text-white">
              Specifications
            </h2>

            <div className="space-y-6">
              {/* Capacity */}
              {rental.capacity && (
                <div className="rounded-xl bg-white/5 border border-white/10 p-6 backdrop-blur">
                  <p className="mb-2 text-sm font-semibold text-cyan-400 uppercase tracking-wider">
                    Recommended Capacity
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-white">
                    {rental.capacity} guests
                  </p>
                </div>
              )}

              {/* Category */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 backdrop-blur">
                <p className="mb-2 text-sm font-semibold text-cyan-400 uppercase tracking-wider">
                  Category
                </p>
                <p className="text-xl md:text-2xl font-bold text-white capitalize">
                  {rental.category.replace("-", " ")}
                </p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <h2 className="mb-8 text-3xl md:text-4xl font-bold text-white">
              Features & Highlights
            </h2>

            <div className="space-y-4">
              {rental.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-cyan-400/5 border border-cyan-500/20 p-4"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Check className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {feature}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Info */}
            <div className="mt-8 rounded-xl bg-white/5 border border-white/10 p-6 backdrop-blur">
              <p className="text-sm text-gray-400 mb-3">
                <span className="font-semibold text-white">Note:</span> Setup and
                delivery included in the rental price.
              </p>
              <p className="text-sm text-gray-400">
                Contact us for custom packages and multi-day rental discounts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
