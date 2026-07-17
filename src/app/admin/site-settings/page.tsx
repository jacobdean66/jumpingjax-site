import Link from "next/link";

import { loadSiteSettings } from "@/lib/admin/site-settings";
import {
  formatUsd,
  priceFacilityPartyWithConfig,
} from "@/lib/facility-parties/pricing";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string; message?: string; error?: string }>;
};

type PriceInput = {
  name: string;
  label: string;
  help: string;
  value: number;
};

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base font-semibold text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

function settingsHref(token: string, path: string): string {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${path}${query}`;
}

function FormFooter({ label }: { label: string }) {
  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <button
        type="submit"
        className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
      >
        {label}
      </button>
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

  const settings = await loadSiteSettings();
  const priceRows = [
    {
      label: "10 kid public party",
      context: "Room 10, 90 minutes",
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
    },
    {
      label: "20 kid public party",
      context: "Room 20, 90 minutes, Wednesday/Thursday",
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
    },
    {
      label: "20 kid private party",
      context: "Room 20, 90 minutes, Monday/Tuesday baseline",
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
    },
  ];
  const priceInputs: PriceInput[] = [
    {
      name: "publicRoom10",
      label: "10 kid public party",
      help: "Room 10, 90 minutes",
      value: settings.facilityPricing.publicRoom10,
    },
    {
      name: "publicRoom20Weekday",
      label: "20 kid public party, Wed/Thu",
      help: "Room 20, 90 minutes",
      value: settings.facilityPricing.publicRoom20Weekday,
    },
    {
      name: "publicRoom20Weekend",
      label: "20 kid public party, Fri/Sat",
      help: "Room 20, 90 minutes",
      value: settings.facilityPricing.publicRoom20Weekend,
    },
    {
      name: "privateWeekday90",
      label: "Private party, Mon/Tue, 90 minutes",
      help: "Full facility",
      value: settings.facilityPricing.privateWeekday90,
    },
    {
      name: "privateWeekday120",
      label: "Private party, Mon/Tue, 120 minutes",
      help: "Full facility",
      value: settings.facilityPricing.privateWeekday120,
    },
    {
      name: "privateWeekend90",
      label: "Private party, Fri/Sat/Sun, 90 minutes",
      help: "Full facility",
      value: settings.facilityPricing.privateWeekend90,
    },
    {
      name: "privateWeekend120",
      label: "Private party, Fri/Sat/Sun, 120 minutes",
      help: "Full facility",
      value: settings.facilityPricing.privateWeekend120,
    },
    {
      name: "privateAny180",
      label: "Private party, any day, 180 minutes",
      help: "Full facility",
      value: settings.facilityPricing.privateAny180,
    },
  ];

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Settings" title="Website Settings" />
      <AdminNav token={token} role={auth.role} active="site-settings" />

      {resolved?.message ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-900">
          {resolved.message}
        </div>
      ) : null}
      {resolved?.error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-900">
          {resolved.error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Rental Catalog
          </p>
          <h2 className="mt-2 text-2xl font-black">Inventory</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
            Edit rental item names, prices, descriptions, categories, photos,
            and visibility in the Inventory editor.
          </p>
          <Link
            href={settingsHref(token, "/admin/inventory")}
            className="mt-5 inline-flex rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
          >
            Open Inventory
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Reports
          </p>
          <h2 className="mt-2 text-2xl font-black">Tax / Booking Exports</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
            Export booking records for bookkeeping by event date, created date,
            or payment date.
          </p>
          <Link
            href={settingsHref(token, "/admin/reports/tax-export")}
            className="mt-5 inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-200"
          >
            Open Tax / Booking Exports
          </Link>
        </div>
      </section>

      <form
        action="/api/admin/site-settings"
        method="post"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="action" value="facility-pricing" />
        <div className="border-b border-slate-200 pb-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Facility Party Prices
          </p>
          <h2 className="mt-2 text-2xl font-black">Change party prices</h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed text-slate-600">
            These prices feed the facility party page, customer price preview,
            and the server total saved on each booking.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {priceRows.map((row) => (
            <div
              key={row.label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="font-black text-slate-950">{row.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {row.context}
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {formatUsd(row.price)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {priceInputs.map((field) => (
            <label key={field.name} className="block">
              <span className="text-sm font-black text-slate-900">
                {field.label}
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                {field.help}
              </span>
              <input
                type="number"
                name={field.name}
                min="0"
                step="0.01"
                defaultValue={field.value}
                className={inputClassName}
              />
            </label>
          ))}
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Tax percent
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-slate-500">
              Enter 7 for 7%.
            </span>
            <input
              type="number"
              name="taxPercent"
              min="0"
              max="100"
              step="0.01"
              defaultValue={settings.facilityPricing.taxRate * 100}
              className={inputClassName}
            />
          </label>
        </div>
        <FormFooter label="Save facility prices" />
      </form>

      <form
        action="/api/admin/site-settings"
        method="post"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="action" value="business-hours" />
        <div className="border-b border-slate-200 pb-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Business Info
          </p>
          <h2 className="mt-2 text-2xl font-black">Change website hours</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Use the Closed checkbox for days that should show as closed.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {settings.businessHours.map((row, index) => (
            <div key={row.day} className="rounded-xl bg-slate-50 p-4">
              <label className="block">
                <span className="text-sm font-black text-slate-900">
                  {row.day}
                </span>
                <input
                  type="text"
                  name={`hours-${index}`}
                  defaultValue={row.hours}
                  className={inputClassName}
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm font-black text-slate-700">
                <input
                  type="checkbox"
                  name={`closed-${index}`}
                  defaultChecked={row.closed === true}
                  className="h-4 w-4 accent-sky-600"
                />
                Closed
              </label>
            </div>
          ))}
        </div>
        <FormFooter label="Save hours" />
      </form>

      <form
        action="/api/admin/site-settings"
        method="post"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="action" value="website-text" />
        <div className="border-b border-slate-200 pb-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Website Text
          </p>
          <h2 className="mt-2 text-2xl font-black">Change website text</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            This stores the owner-editable copy for the main website pages.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Business tagline
            </span>
            <input
              type="text"
              name="businessTagline"
              defaultValue={settings.websiteText.businessTagline}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Contact phone
            </span>
            <input
              type="text"
              name="contactPhone"
              defaultValue={settings.websiteText.contactPhone}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Contact email
            </span>
            <input
              type="email"
              name="contactEmail"
              defaultValue={settings.websiteText.contactEmail}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Contact address
            </span>
            <input
              type="text"
              name="contactAddress"
              defaultValue={settings.websiteText.contactAddress}
              className={inputClassName}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-black text-slate-900">
              Business description
            </span>
            <textarea
              name="businessDescription"
              rows={3}
              defaultValue={settings.websiteText.businessDescription}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Home page title
            </span>
            <input
              type="text"
              name="homeTitle"
              defaultValue={settings.websiteText.homeTitle}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Rentals page title
            </span>
            <input
              type="text"
              name="rentalsTitle"
              defaultValue={settings.websiteText.rentalsTitle}
              className={inputClassName}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-black text-slate-900">
              Home page description
            </span>
            <textarea
              name="homeDescription"
              rows={3}
              defaultValue={settings.websiteText.homeDescription}
              className={inputClassName}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-black text-slate-900">
              Rentals page description
            </span>
            <textarea
              name="rentalsDescription"
              rows={3}
              defaultValue={settings.websiteText.rentalsDescription}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Facility parties title
            </span>
            <input
              type="text"
              name="facilityPartiesTitle"
              defaultValue={settings.websiteText.facilityPartiesTitle}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-900">
              Contact page title
            </span>
            <input
              type="text"
              name="contactTitle"
              defaultValue={settings.websiteText.contactTitle}
              className={inputClassName}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-black text-slate-900">
              Facility parties description
            </span>
            <textarea
              name="facilityPartiesDescription"
              rows={3}
              defaultValue={settings.websiteText.facilityPartiesDescription}
              className={inputClassName}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-black text-slate-900">
              Contact page description
            </span>
            <textarea
              name="contactDescription"
              rows={3}
              defaultValue={settings.websiteText.contactDescription}
              className={inputClassName}
            />
          </label>
        </div>
        <FormFooter label="Save website text" />
      </form>
    </AdminShell>
  );
}
