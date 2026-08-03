"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteChrome() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/logistics")
  ) {
    return null;
  }

  return (
    <header className="overflow-x-hidden border-b-4 border-pink-400 bg-white/95 shadow-[0_10px_0_rgba(236,72,153,0.12)] backdrop-blur">
      <div className="h-2 bg-[linear-gradient(90deg,#f97316_0%,#facc15_22%,#22c55e_45%,#06b6d4_68%,#ec4899_100%)]" />
      <div className="bg-slate-950 px-4 py-2 text-center text-sm font-bold text-white sm:text-base">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 sm:flex-row sm:gap-6">
          <a href="tel:8649331420" className="hover:text-yellow-300">
            864-933-1420
          </a>
          <a
            href="https://www.google.com/maps/search/?api=1&query=559%20Beaudrot%20Rd%2C%20Greenwood%2C%20SC%2029649"
            className="hover:text-yellow-300"
          >
            559 Beaudrot Rd, Greenwood, SC
          </a>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-6xl gap-3 px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
        <Link
          href="/"
          className="inline-flex w-fit rotate-[-1deg] rounded-full bg-pink-500 px-5 py-2 text-lg font-black tracking-wide text-white shadow-[0_5px_0_rgba(190,24,93,0.35)] transition hover:rotate-0 hover:bg-pink-600"
        >
          Jumping Jax
        </Link>
        <nav className="site-mobile-nav grid w-full min-w-0 grid-cols-1 gap-2 text-xs font-semibold md:w-auto md:flex md:flex-wrap md:items-center md:justify-end md:text-base">
          <Link
            href="/"
            className="flex min-h-11 min-w-0 items-center justify-center rounded-full bg-cyan-100 px-3 py-2 text-center leading-tight text-cyan-950 shadow-[0_4px_0_rgba(14,116,144,0.15)] transition hover:-translate-y-0.5 hover:bg-cyan-200 md:px-4"
          >
            Home
          </Link>
          <Link
            href="/facility-parties"
            className="flex min-h-11 min-w-0 items-center justify-center rounded-full bg-lime-100 px-3 py-2 text-center leading-tight text-lime-950 shadow-[0_4px_0_rgba(77,124,15,0.15)] transition hover:-translate-y-0.5 hover:bg-lime-200 md:px-4"
          >
            Facility Parties
          </Link>
          <Link
            href="/rentals"
            className="flex min-h-11 min-w-0 items-center justify-center rounded-full bg-pink-100 px-3 py-2 text-center leading-tight text-pink-950 shadow-[0_4px_0_rgba(190,24,93,0.15)] transition hover:-translate-y-0.5 hover:bg-pink-200 md:px-4"
          >
            Rentals
          </Link>
          <Link
            href="/rentals/foam-parties"
            className="flex min-h-11 min-w-0 items-center justify-center rounded-full bg-sky-100 px-3 py-2 text-center leading-tight text-sky-950 shadow-[0_4px_0_rgba(3,105,161,0.15)] transition hover:-translate-y-0.5 hover:bg-sky-200 md:px-4"
          >
            Foam Parties
          </Link>
          <Link
            href="/#contact"
            className="flex min-h-11 min-w-0 items-center justify-center rounded-full bg-orange-100 px-3 py-2 text-center leading-tight text-orange-950 shadow-[0_4px_0_rgba(194,65,12,0.15)] transition hover:-translate-y-0.5 hover:bg-orange-200 md:px-4"
          >
            Contact
          </Link>
          <a
            href="https://waiver.smartwaiver.com/w/53e5041a939c7/web/"
            target="_blank"
            rel="noopener noreferrer"
            className="jj-pop-button flex min-h-11 min-w-0 items-center justify-center rounded-full bg-lime-300 px-3 py-2 text-center font-black leading-tight text-slate-950 transition hover:bg-lime-200 md:px-5"
          >
            Waiver
          </a>
          <Link
            href="/rentals"
            className="jj-pop-button flex min-h-11 min-w-0 items-center justify-center rounded-full bg-yellow-300 px-3 py-2 text-center font-black leading-tight text-slate-950 transition hover:bg-yellow-200 md:px-5"
          >
            Book Now
          </Link>
        </nav>
      </div>
      <div className="jj-party-ribbon px-4 py-2 text-center text-xs font-black uppercase text-white sm:text-sm">
        Open Play | Birthday Parties | Water Slides | Foam Parties | Bounce Houses
      </div>
    </header>
  );
}
