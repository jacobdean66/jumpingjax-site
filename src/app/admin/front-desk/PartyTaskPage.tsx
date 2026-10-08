import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { facilityAdminDay } from "@/lib/admin/facility-admin-date";
import { loadAdminFacilityBookings } from "@/lib/admin/operations";
import { facilityDepositStatus, formatCents, remainingBookingBalanceCents, sumBookingPaymentCents } from "@/lib/payments/booking-payments";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell, StatusBadge } from "../_components";
import { BookingPaymentButton } from "../BookingPaymentButton";

export type PartyTaskParams = { q?: string; view?: string };

export async function PartyTaskPage({ task, searchParams }: { task: "deposits" | "invitations"; searchParams: Promise<PartyTaskParams> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 200);
  const view = params.view === "past" ? "past" : "upcoming";
  const title = task === "deposits" ? "Facility Deposits" : "Make / Print Invitations";
  const result = await loadAdminFacilityBookings({ status: "all", view, today: facilityAdminDay(), search: q })
    .then(data => ({ bookings: data.bookings, error: false }))
    .catch(() => ({ bookings: [], error: true }));
  return <AdminShell>
    <AdminHeader eyebrow="Front Desk" title={title} />
    <AdminNav role={auth.role} token="" active={task} />
    <p className="mt-4 text-sm font-semibold text-slate-600">{task === "deposits" ? "Confirm the party and deposit status before opening its payment form." : "Select a party to make, preview or print its invitations."}</p>
    <form className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <label className="text-sm font-bold">Find a party
        <input name="q" defaultValue={q} type="search" placeholder="Child, parent, customer, phone or party date" className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
      </label>
      <label className="text-sm font-bold">Party dates
        <select name="view" defaultValue={view} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base"><option value="upcoming">Today & future</option><option value="past">Past parties</option></select>
      </label>
      <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white hover:bg-sky-600">Find party</button>
    </form>
    <section aria-label="Matching facility parties" className="mt-5 grid gap-3 md:grid-cols-2">
      {result.error ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4">Party records could not load. Please retry; no payment status has been assumed.</p> : result.bookings.length === 0 ? <p className="p-4 font-semibold">No parties match these filters. Try another name or date range.</p> : result.bookings.map(booking => {
        const deposit = facilityDepositStatus(booking.paymentEntries);
        const active = !["cancelled", "canceled", "rejected"].includes(booking.status);
        return <article key={booking.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black">{booking.childName || booking.customerName}</h2><StatusBadge status={booking.status} /></div>
          <p className="mt-2 text-sm font-semibold">{booking.customerName} · {booking.readableDate || new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium" }).format(new Date(booking.startTime))} · {booking.readableTime || "Time not set"}</p>
          <p className="mt-1 text-xs text-slate-500 break-all">Booking #{booking.id}</p>
          <p className={`mt-2 text-sm font-bold ${deposit === "paid" ? "text-emerald-800" : "text-amber-800"}`}>{deposit === "paid" ? "Deposit paid" : deposit === "review" ? "Deposit needs verification" : "Deposit not paid"}</p>
          {task === "deposits" ? <>
            <p className="mt-1 text-xs text-slate-600">{booking.total === null ? "Balance not set" : `Remaining balance: ${formatCents(remainingBookingBalanceCents(booking.total, sumBookingPaymentCents(booking.paymentEntries)) ?? 0)}`}</p>
            <div className="mt-3">{active ? <BookingPaymentButton bookingId={booking.id} kind="facility" customerName={booking.customerName} customerEmail={booking.email} balanceCents={remainingBookingBalanceCents(booking.total, sumBookingPaymentCents(booking.paymentEntries))} depositRecorded={deposit === "paid"} /> : <p className="text-sm font-semibold">Payment collection is unavailable for this party status.</p>}</div>
          </> : <Link href={`/admin/facility/${encodeURIComponent(booking.id)}/invitations`} prefetch={false} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">Make / Print Invitations</Link>}
          <Link href={`/admin/facility?view=${view}#booking-${encodeURIComponent(booking.id)}`} className="mt-3 block text-sm font-bold text-sky-700 underline">View party details</Link>
        </article>;
      })}
    </section>
  </AdminShell>;
}
