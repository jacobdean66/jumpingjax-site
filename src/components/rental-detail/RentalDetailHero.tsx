import Image from "next/image";
import { RentalItem } from "@/lib/types";

interface RentalDetailHeroProps {
  rental: RentalItem;
}

export default function RentalDetailHero({ rental }: RentalDetailHeroProps) {
  // Use heroImage if available, fallback to main image
  const displayImage = rental.heroImage || rental.image;

  return (
    <div className="relative w-full overflow-hidden pt-24">
      {/* Hero Image */}
      <div className="relative h-96 w-full md:h-[500px] lg:h-[600px]">
        <Image
          src={displayImage}
          alt={rental.name}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Content Overlay */}
      <div className="relative -mt-32 mx-4 md:-mt-40 md:mx-6">
        <div className="mx-auto max-w-6xl rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-8 md:p-12 backdrop-blur border border-white/10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <h1 className="mb-3 text-4xl md:text-5xl lg:text-6xl font-black text-white">
                {rental.name}
              </h1>
              <p className="text-base md:text-lg text-gray-300 max-w-2xl">
                {rental.description}
              </p>
            </div>

            <div className="flex flex-col gap-4 md:items-end">
              {/* Availability Status */}
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    rental.available ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span
                  className={`font-semibold ${
                    rental.available ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {rental.available ? "Available" : "Not Available"}
                </span>
              </div>

              {/* Price */}
              <div className="text-right">
                <p className="text-sm text-gray-400 mb-1">Starting at</p>
                <p className="text-4xl md:text-5xl font-black text-cyan-400">
                  ${rental.price}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
