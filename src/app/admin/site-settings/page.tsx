import Link from "next/link";
import { business, businessHours, contact, pageSEO } from "@/data/site";
import { formatUsd, priceFacilityParty } from "@/lib/facility-parties/pricing";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

type SettingSection = {
  title: string;
  eyebrow: string;
  description: string;
  actionLabel: string;
  href?: string;
};

function settingsHref(token: string, path: string): string {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${path}${query}`;
}

function priceRows() {
  return [
    {
      label: "10 kid public party",
      context: "Room 10, 90 minutes",
      price: priceFacilityParty({
        partyKind: "public",
        roomId: "room-10",
        date: "2026-07-15",
        durationMinutes: 90,
        addonSubtotal: 0,
      }).packagePrice,
    },
    {
      label: "20 kid public party",
      context: "Room 20, 90 minutes, Wednesday/Thursday",
      price: priceFacilityParty({
        partyKind: "public",
        roomId: "room-20",
        date: "2026-07-15",
        durationMinutes: 90,
        addonSubtotal: 0,
      }).packagePrice,
    },
    {
      label: "20 kid public weekend party",
      context: "Room 20, 90 minutes, Friday/Saturday",
      price: priceFacilityParty({
        partyKind: "public",
        roomId: "room-20",
        date: "2026-07-17",
        durationMinutes: 90,
        addonSubtotal: 0,
      }).packagePrice,
    },
    {
      label: "20 kid private party",
      context: "Room 20, 90 minutes, Monday/Tuesday",
      price: priceFacilityParty({
        partyKind: "private",
        roomId: "room-20",
        date: "2026-07-13",
        durationMinutes: 90,
        addonSubtotal: 0,
      }).packagePrice,
    },
    {
      label: "20 kid private weekend party",
      context: "Room 20, 90 minutes, Friday/Saturday/Sunday",
      price: priceFacilityParty({
        partyKind: "private",
        roomId: "room-20",
        date: "2026-07-17",
        durationMinutes: 90,
        addonSubtotal: 0,
      }).packagePrice,
    },
  ];
}

function SettingCard({
  section,
}: {
  section: SettingSection;
}) {
  const content = (
    <>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
        {section.eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black">{section.title}</h2>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
        {section.description}
      </p>
      <span className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
        {section.actionLabel}
      </span>
    </>
  );

  if (section.href) {
    return (
      <Link
        href={section.href}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {content}
    </div>
  );
}

export default async function AdminSiteSettingsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminOwnerAccess(token);

  if (!auth.ok) {
    return <AdminAuthError reason={auth.reason} />;
  }

  const sections: SettingSection[] = [
    {
      title: "Add or Change Rental Items",
      eyebrow: "Rental Catalog",
      description:
        "Add new rentals, update names, change prices, upload photos, and edit rental descriptions from Inventory.",
      actionLabel: "Open inventory editor",
      href: settingsHref(token, "/admin/inventory"),
    },
    {
      title: "Facility Party Prices",
      eyebrow: "Party Pricing",
      description:
        "Use this section to review the live baseline facility party prices before requesting a price update.",
      actionLabel: "Review current prices",
      href: "#facility-prices",
    },
    {
      title: "Hours",
      eyebrow: "Business Info",
      description:
        "Review the current public business hours shown on the website.",
      actionLabel: "Review current hours",
      href: "#business-hours",
    },
    {
      title: "Website Text",
      eyebrow: "Content",
      description:
        "Review the main public website text, including homepage, rentals, facility parties, and contact descriptions.",
      actionLabel: "Review current text",
      href: "#website-text",
    },
  ];

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Settings" title="Website Settings" />
      <AdminNav token={token} role={auth.role} active="site-settings" />

      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">
          Owner Note
        </p>
        <h2 className="mt-2 text-2xl font-black text-amber-950">
          Website changes are grouped here.
        </h2>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed text-amber-900">
          Rental items can already be added in Inventory. Facility prices,
          hours, and general website text are shown here so updates are easy to
          identify and request without hunting through the admin dashboard.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <SettingCard key={section.title} section={section} />
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div
          id="facility-prices"
          className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Facility Party Prices
            </p>
            <h2 className="mt-2 text-2xl font-black">Current baseline prices</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              These are informational rows from the live pricing rules. Add-ons
              and tax are calculated separately during booking.
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            {priceRows().map((row) => (
              <div
                key={`${row.label}-${row.context}`}
                className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-black text-slate-950">{row.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {row.context}
                  </p>
                </div>
                <p className="text-2xl font-black text-slate-950">
                  {formatUsd(row.price)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          id="business-hours"
          className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Hours
            </p>
            <h2 className="mt-2 text-2xl font-black">Current website hours</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {businessHours.map((row) => (
              <div
                key={row.day}
                className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
              >
                <p className="font-black">{row.day}</p>
                <p
                  className={
                    row.closed
                      ? "font-black text-rose-700"
                      : "font-black text-slate-700"
                  }
                >
                  {row.hours}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="website-text"
        className="mt-8 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="border-b border-slate-200 pb-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Website Text
          </p>
          <h2 className="mt-2 text-2xl font-black">Current public copy</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            This groups the main text owners most often need to change.
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Business tagline
            </p>
            <p className="mt-2 font-bold text-slate-800">{business.tagline}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Contact
            </p>
            <p className="mt-2 font-bold text-slate-800">
              {contact.phone} · {contact.email}
            </p>
            {contact.address ? (
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {contact.address}
              </p>
            ) : null}
          </div>
          {Object.entries(pageSEO).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                {key}
              </p>
              <p className="mt-2 font-black text-slate-950">{value.title}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
