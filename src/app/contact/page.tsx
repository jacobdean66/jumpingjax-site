import Link from "next/link";
import { loadSiteSettings } from "@/lib/admin/site-settings";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const settings = await loadSiteSettings();
  const phoneHref = `tel:${settings.websiteText.contactPhone.replace(/\D/g, "")}`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    settings.websiteText.contactAddress,
  )}`;

  return (
    <main className="min-h-screen bg-cyan-100 px-4 py-12 text-slate-950 sm:px-6">
      <section className="mx-auto max-w-4xl rounded-3xl border-2 border-pink-200 bg-white px-5 py-10 text-center shadow-[0_18px_48px_rgba(236,72,153,0.14)] sm:px-8">
        <span className="inline-flex rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-800">
          Contact Us
        </span>
        <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
          {settings.websiteText.contactTitle}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-700 sm:text-lg">
          {settings.websiteText.contactDescription}
        </p>

        <div className="mt-8 grid gap-4 text-lg font-bold sm:grid-cols-3">
          <a
            href={phoneHref}
            className="rounded-3xl border-2 border-cyan-100 bg-cyan-50 px-5 py-6 text-cyan-900 transition hover:bg-cyan-100"
          >
            {settings.websiteText.contactPhone}
          </a>
          <a
            href={`mailto:${settings.websiteText.contactEmail}`}
            className="rounded-3xl border-2 border-pink-100 bg-pink-50 px-5 py-6 text-pink-900 transition hover:bg-pink-100"
          >
            {settings.websiteText.contactEmail}
          </a>
          <a
            href={mapsHref}
            className="rounded-3xl border-2 border-yellow-100 bg-yellow-50 px-5 py-6 text-yellow-950 transition hover:bg-yellow-100"
          >
            {settings.websiteText.contactAddress}
          </a>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/rentals"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-500 px-8 text-base font-bold text-white transition hover:bg-cyan-600"
          >
            Book Rentals
          </Link>
          <Link
            href="/facility-parties"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-pink-500 px-8 text-base font-bold text-white transition hover:bg-pink-600"
          >
            Request a Facility Party
          </Link>
        </div>
      </section>
    </main>
  );
}
