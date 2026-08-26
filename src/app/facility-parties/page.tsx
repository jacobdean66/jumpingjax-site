import { Suspense } from "react";

import { FacilityPartyBookingForm } from "@/components/facility-parties/FacilityPartyBookingForm";
import {
  DEFAULT_SITE_SETTINGS,
  loadSiteSettings,
} from "@/lib/admin/site-settings";
import {
  formatUsd,
  priceFacilityPartyWithConfig,
} from "@/lib/facility-parties/pricing";
import {
  createJsonLdScript,
  generateBreadcrumbSchema,
  generateFacilityPartiesMetadata,
  generateServiceSchema,
} from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const metadata = generateFacilityPartiesMetadata();

export default async function FacilityPartiesPage() {
  let settings = DEFAULT_SITE_SETTINGS;
  try {
    settings = await loadSiteSettings();
  } catch {
    // Local/dev without Supabase still needs the booking form UI.
    settings = DEFAULT_SITE_SETTINGS;
  }
  const baselinePartyPrices = [
    {
      label: "10 kid public party",
      price: priceFacilityPartyWithConfig(
        {
          partyKind: "public",
          roomId: "room-10",
          date: "2026-07-15",
          durationMinutes: 90,
          addonSubtotal: 0,
        },
        settings.facilityPricing,
      ).packagePrice,
      note: "1.5 hour public play slot",
    },
    {
      label: "20 kid public party",
      price: priceFacilityPartyWithConfig(
        {
          partyKind: "public",
          roomId: "room-20",
          date: "2026-07-15",
          durationMinutes: 90,
          addonSubtotal: 0,
        },
        settings.facilityPricing,
      ).packagePrice,
      note: "1.5 hour public play slot",
    },
    {
      label: "20 kid private party",
      price: priceFacilityPartyWithConfig(
        {
          partyKind: "private",
          roomId: "room-20",
          date: "2026-07-13",
          durationMinutes: 90,
          addonSubtotal: 0,
        },
        settings.facilityPricing,
      ).packagePrice,
      note: "Private full-facility baseline",
    },
  ];

  return (
    <main className="min-h-screen bg-lime-100 px-4 pb-16 pt-8 text-slate-950 sm:px-6 sm:pt-10 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLdScript([
          generateBreadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Facility Parties", path: "/facility-parties" },
          ]),
          generateServiceSchema(
            "Kids' Birthday Party Venue in Greenwood, SC",
            "Indoor birthday party rooms and private facility party options at Jumping Jax in Greenwood, SC.",
            "/facility-parties",
            "Birthday party venue",
          ),
        ])}
      />
      <section className="mx-auto max-w-4xl rounded-3xl border-2 border-pink-200 bg-white px-5 py-10 text-center shadow-[0_18px_48px_rgba(236,72,153,0.14)] sm:px-8">
        <span className="inline-flex rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-800">
          Facility Parties
        </span>
        <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
          {settings.websiteText.facilityPartiesTitle}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
          {settings.websiteText.facilityPartiesDescription}
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm font-semibold leading-6 text-slate-700 sm:text-base">
          Reserve an indoor kids&apos; birthday party venue in Greenwood with
          inflatable play and a dedicated party room.
        </p>
      </section>

      <section
        aria-label="Facility party baseline prices"
        className="mx-auto mt-4 max-w-5xl rounded-2xl border-2 border-slate-200 bg-white px-5 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] sm:px-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Baseline party prices
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Information only. Choose your date, time, room, and add-ons in the
              booking form below.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[560px]">
            {baselinePartyPrices.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-sm font-black text-slate-950">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-black text-pink-600">
                  {formatUsd(item.price)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-4 max-w-5xl">
        <Suspense
          fallback={
            <div className="rounded-3xl border-2 border-slate-200 bg-white px-5 py-10 text-center text-sm font-semibold text-slate-500">
              Loading booking form…
            </div>
          }
        >
          <FacilityPartyBookingForm pricingConfig={settings.facilityPricing} />
        </Suspense>
      </section>
    </main>
  );
}
