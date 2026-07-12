import { FacilityPartyBookingForm } from "@/components/facility-parties/FacilityPartyBookingForm";
import { priceFacilityParty, formatUsd } from "@/lib/facility-parties/pricing";

const baselinePartyPrices = [
  {
    label: "10 kid public party",
    price: priceFacilityParty({
      partyKind: "public",
      roomId: "room-10",
      date: "2026-07-15",
      durationMinutes: 90,
      addonSubtotal: 0,
    }).packagePrice,
    note: "1.5 hour public play slot",
  },
  {
    label: "20 kid public party",
    price: priceFacilityParty({
      partyKind: "public",
      roomId: "room-20",
      date: "2026-07-15",
      durationMinutes: 90,
      addonSubtotal: 0,
    }).packagePrice,
    note: "1.5 hour public play slot",
  },
  {
    label: "20 kid private party",
    price: priceFacilityParty({
      partyKind: "private",
      roomId: "room-20",
      date: "2026-07-13",
      durationMinutes: 90,
      addonSubtotal: 0,
    }).packagePrice,
    note: "Private full-facility baseline",
  },
];

export default function FacilityPartiesPage() {
  return (
    <main className="min-h-screen bg-lime-100 px-4 pb-16 pt-8 text-slate-950 sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-3xl border-2 border-pink-200 bg-white px-5 py-10 text-center shadow-[0_18px_48px_rgba(236,72,153,0.14)] sm:px-8">
        <span className="inline-flex rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-800">
          Facility Parties
        </span>
        <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
          Host Your Party at Jumping Jax
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
          Reserve our indoor facility for birthdays, school celebrations, and
          private events. We handle setup and cleanup so your group can focus on
          having fun.
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
        <FacilityPartyBookingForm />
      </section>
    </main>
  );
}
