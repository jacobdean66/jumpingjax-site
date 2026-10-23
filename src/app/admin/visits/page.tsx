import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadAdminRentalBookings, loadAdminFacilityBookings } from "@/lib/admin/operations";
import { facilityVisitMatches, rentalVisitMatches, visitBookingHref } from "@/lib/admin/visit-hub";
import { resolveRentalDashboardDates, rentalDashboardToday } from "@/lib/admin/rental-dashboard-view";
import { loadAgreementHistory } from "@/lib/rental-agreements/store";
import { agreementState, agreementStateLabel } from "@/lib/rental-agreements/workflow";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell, StatusBadge } from "../_components";

export const dynamic = "force-dynamic";
const button = "inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white";
const money = (value: number | null) => value === null ? "Not recorded" : `$${value.toFixed(2)}`;

export default async function VisitsPage({ searchParams }: { searchParams?: Promise<{ day?: string; kind?: string; q?: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams ?? {};
  const today = rentalDashboardToday();
  const day = resolveRentalDashboardDates({ from: params.day }).from ?? today;
  const kind = params.kind === "facility" ? "facility" : "rentals";
  const query = (params.q ?? "").trim().slice(0, 120);
  const dates = resolveRentalDashboardDates({ from: day, to: day }, today);
  // Only load the selected service, after the staff authorization check.
  const data = await (async () => {
    try {
      if (kind === "facility") {
        const { bookings } = await loadAdminFacilityBookings({ from: day, to: day, status: "all" });
        return { kind: "facility" as const, bookings: bookings.filter(booking => facilityVisitMatches(booking, query)) };
      }
      const { bookings } = await loadAdminRentalBookings({ dashboardDates: dates, status: "all" });
      const matches = bookings.filter(booking => rentalVisitMatches(booking, query));
      const agreements = await loadAgreementHistory(matches.map(booking => booking.id));
      return { kind: "rentals" as const, bookings: matches, agreements };
    } catch {
      return null;
    }
  })();
  const tabHref = (next: string) => `/admin/visits?${new URLSearchParams({ day, kind: next, q: query })}`;
  return <AdminShell>
    <AdminHeader eyebrow="Front desk" title="Bookings & visits"><AdminNav token="" role={auth.role} /></AdminHeader>
    <p className="mt-4 text-sm text-slate-600">Find a booking, check its paperwork and pricing, then open the appropriate desk. Confirm the name and event details with the customer.</p>
    <nav aria-label="Visit type" className="mt-5 flex flex-wrap gap-3">
      <Link href={tabHref("rentals")} aria-current={kind === "rentals" ? "page" : undefined} className={kind === "rentals" ? button : "rounded-xl border border-slate-300 p-3 font-bold"}>Inflatable rentals</Link>
      <Link href={tabHref("facility")} aria-current={kind === "facility" ? "page" : undefined} className={kind === "facility" ? button : "rounded-xl border border-slate-300 p-3 font-bold"}>Facility &amp; Open Play</Link>
    </nav>
    <form className="mt-5 flex flex-wrap items-end gap-3">
      <input type="hidden" name="kind" value={kind} />
      <label className="text-sm font-bold">Visit date<input type="date" name="day" defaultValue={day} required className="mt-1 block min-h-11 rounded-xl border border-slate-300 px-3" /></label>
      <label className="min-w-0 flex-1 text-sm font-bold">Name, email, phone or booking number<input type="search" name="q" defaultValue={query} maxLength={120} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      <button className={button}>Find bookings</button>
    </form>
    {kind === "facility" ? <aside className="mt-5 rounded-2xl border border-pink-200 bg-pink-50 p-5">
      <h2 className="text-xl font-black">Open Play &amp; participant check-in</h2>
      <p className="mt-2 text-sm">Walk-ins appear in the waiver desk, even without a party booking. Search the signer or participant there, verify their waiver and mark everyone attending. A party agreement does not replace participant waivers.</p>
      <Link href="/admin/check-in#check-in-desk" className={`${button} mt-3`}>Open waiver check-in desk</Link>
      <p className="mt-3 text-xs">The Google 15% offer is for eligible inflatable rentals only. Facility admission and party pricing are separate.</p>
    </aside> : <p className="mt-4 text-sm text-slate-600">Saved rental prices already include any applied offer. Review the agreement terms below; do not subtract the discount a second time. Open the booking for fulfillment and payment details.</p>}
    {!data ? <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 font-bold text-amber-950">Booking or agreement records could not load. Retry before assuming a booking or signature is missing.</p> : <>
      <h2 className="mt-6 text-xl font-black">{kind === "rentals" ? "Rental bookings" : "Facility party bookings"} · {data.bookings.length}</h2>
      {!data.bookings.length && <p className="mt-3 text-slate-600">No matching bookings for this date. Try a different date or search.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {data.kind === "rentals" ? data.bookings.map(booking => {
          const agreement = data.agreements.get(booking.id)?.[0];
          return <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <StatusBadge status={booking.status} /><h3 className="mt-3 text-xl font-black">{booking.customerName}</h3>
            <p className="mt-1 break-words text-sm">#{booking.id} · {booking.eventDate} · {booking.items.map(item => item.rental_name).join(", ")}</p>
            <p className="mt-2 text-sm font-bold">Rental agreement: {agreementStateLabel[agreementState(booking.customerName, agreement)]}</p>
            <p className="mt-2 text-sm">Saved booking total: <strong>{money(booking.total)}</strong></p>
            {agreement?.snapshot.additionalTerms && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950"><p className="font-bold">Recorded agreement terms / offer</p><p className="mt-1 whitespace-pre-wrap break-words">{agreement.snapshot.additionalTerms}</p>{agreement.status === "superseded" && <p className="mt-1 font-bold">Historical agreement: review current booking pricing.</p>}</div>}
            <Link className={`${button} mt-4`} href={visitBookingHref("rentals", booking.id, day, today)}>Open rental &amp; agreement</Link>
          </article>;
        }) : data.bookings.map(booking => <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <StatusBadge status={booking.status} /><h3 className="mt-3 text-xl font-black">{booking.customerName}</h3>
          <p className="mt-1 text-sm">{booking.childName ? `${booking.childName} · ` : ""}{booking.readableDate} {booking.readableTime}</p>
          <p className="mt-2 text-sm">Party agreement: <strong>{booking.agreementHistory[0]?.status ?? "Not recorded"}</strong> · Participant waivers: check at waiver desk</p>
          <p className="mt-2 text-sm">Saved party total: <strong>{money(booking.total)}</strong></p>
          <Link className={`${button} mt-4`} href={visitBookingHref("facility", booking.id, day, today)}>Open party booking</Link>
        </article>)}
      </div>
    </>}
    <Link href="/visit" className="mt-6 inline-flex min-h-11 items-center font-bold text-sky-800 underline">View customer visit page</Link>
  </AdminShell>;
}
