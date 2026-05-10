"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Ruler, Sparkles, Users } from "lucide-react";
import { useBookingStore } from "@/store/bookingStore";

interface RentalCardProps {
  rentalId?: string;
  title: string;
  price: number;
  image: string;
  description: string;
  slug: string;
  category?: string;
  dimensions?: string;
  features?: string[];
}

export default function RentalCard({
  rentalId,
  title,
  price,
  image,
  description,
  slug,
  category,
  dimensions,
  features = [],
}: RentalCardProps) {
  const router = useRouter();
  const setRental = useBookingStore((state) => state.setRental);
  const detailUrl = `/rentals/${slug}`;
  const ageFeature = features.find(
    (feature) => feature.includes("Ages") || feature.includes("Age"),
  );
  const categoryDisplay = category
    ? category
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "";

  const handleReserve = () => {
    setRental({
      rentalId: rentalId || slug,
      rentalTitle: title,
      rentalImage: image,
    });
    router.push("/booking");
  };

  return (
    <div className="group block h-full rounded-[1.5rem] focus-within:outline-none focus-within:ring-2 focus-within:ring-cyan-200 focus-within:ring-offset-4 focus-within:ring-offset-[#071326]">
      <article className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-white text-slate-950 shadow-xl shadow-black/20 transition duration-300 group-hover:-translate-y-1 group-hover:border-cyan-200/70 group-hover:shadow-2xl group-hover:shadow-cyan-950/25">
        <Link
          href={detailUrl}
          className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-200 focus:outline-none sm:aspect-[5/4]"
          aria-label={`View details for ${title}`}
        >
          <Image
            src={image}
            alt={title}
            fill
            priority={false}
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent opacity-80" />
          {categoryDisplay && (
            <div className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-3 py-1.5 text-xs font-bold text-white shadow-lg ring-1 ring-white/15 backdrop-blur">
              {categoryDisplay}
            </div>
          )}
          <div className="absolute bottom-3 right-3 rounded-full bg-cyan-300 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-950 shadow-lg shadow-cyan-950/20">
            From ${price}
          </div>
        </Link>

        <div className="flex flex-1 flex-col p-5">
          <Link
            href={detailUrl}
            className="mb-3 line-clamp-2 text-xl font-black leading-tight tracking-tight text-slate-950 transition-colors duration-200 hover:text-cyan-700 focus:outline-none"
          >
            {title}
          </Link>

          <div className="mb-4 grid gap-2 text-sm text-slate-600">
            {dimensions && (
              <div className="flex items-start gap-2.5">
                <Ruler
                  className="mt-0.5 h-4 w-4 flex-none text-cyan-600"
                  aria-hidden="true"
                />
                <span className="break-words font-medium">{dimensions}</span>
              </div>
            )}
            {ageFeature && (
              <div className="flex items-start gap-2.5">
                <Users
                  className="mt-0.5 h-4 w-4 flex-none text-cyan-600"
                  aria-hidden="true"
                />
                <span className="font-medium">{ageFeature}</span>
              </div>
            )}
            {features[0] && !ageFeature && (
              <div className="flex items-start gap-2.5">
                <Sparkles
                  className="mt-0.5 h-4 w-4 flex-none text-cyan-600"
                  aria-hidden="true"
                />
                <span className="font-medium">{features[0]}</span>
              </div>
            )}
          </div>

          <p className="mb-5 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">
            {description}
          </p>

          <div className="mt-auto flex flex-col gap-4 border-t border-slate-200 pt-5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div className="flex flex-col">
              <span className="text-2xl font-black leading-none text-cyan-700">
                ${price}
              </span>
              <span className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                per day
              </span>
            </div>

            <button
              type="button"
              onClick={handleReserve}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-900/20 transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-600 hover:shadow-cyan-900/30 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-white min-[420px]:w-auto"
            >
              Reserve
              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
