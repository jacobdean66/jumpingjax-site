import { rentalDatePlusDays } from "@/lib/rentals/rental-period";
import { RentalAgreementPanel } from "./RentalAgreementPanel";
import { RentalAgreementTemplateEditor } from "./RentalAgreementTemplateEditor";
import { RentalBookingSquare } from "./RentalBookingSquare";
import { RentalAgreementBatch } from "./RentalAgreementBatch";
import { cityFromAddress, productSummary } from "@/lib/admin/delivery-planner-workspace";
import { agreementState, agreementStateLabel, canRequestAgreement } from "@/lib/rental-agreements/workflow";
import { loadAgreementHistory, customerAgreementPath } from "@/lib/rental-agreements/store";
import type { RentalAgreement } from "@/lib/rental-agreements/types";
import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  defaultFromYmd,
  defaultToYmd,
  loadAdminRentalBookings,
  normalizeStatus,
  normalizeYmd,
  todayYmd,
  type AdminRentalBooking,
} from "@/lib/admin/operations";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
  FilterForm,
  StatusBadge,
} from "../_components";
import { PrintButton } from "../PrintButton";
import { BookingActionButton } from "../BookingActionButton";
import { BulkBookingActionButton } from "../BulkBookingActionButton";
import { RentalCancellationButton } from "./RentalCancellationButton";
import { RentalEditButton } from "./RentalEditButton";
import { RentalRestoreButton } from "./RentalRestoreButton";
import { BookingInvoiceButton } from "../invoices/BookingInvoiceButton";
import { BookingPaymentButton } from "../BookingPaymentButton";
import {
  formatCents,
  paymentStatusLabel,
  projectBookingPaymentStatus,
  receiptAuditLabel,
} from "@/lib/payments/booking-payments";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    from?: string;
    to?: string;
    status?: string;
    q?: string;
    agreement?: string;
  }>;
};

function formatMoney(value: number | null): string {
  if (value === null) return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatTime(value: string | null): string {
  if (!value) return "Not set";
  const [hourRaw, minuteRaw] = value.split(":").map(Number);
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return value;
  const hour = hourRaw % 12 || 12;
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  return `${hour}:${String(minuteRaw).padStart(2, "0")} ${suffix}`;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="compact-print-detail">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function actionHref(id: string, action: "confirm" | "reject" | "cancel") {
  return `/api/rentals/confirm?id=${encodeURIComponent(id)}&action=${action}`;
}

function RentalCard({ booking, agreements }: { booking: AdminRentalBooking; agreements: (RentalAgreement & { path: string })[] }) {
  const paymentProjection = projectBookingPaymentStatus(
    booking.total,
    booking.paymentEntries,
  );
  const canCollectPayment = !["cancelled", "canceled", "rejected"].includes(
    booking.status,
  );
  return (
    <article
      className="compact-print-card bg-white p-4 sm:p-5 print:break-inside-avoid print:border print:border-slate-900"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            <span className="text-xs font-bold text-slate-500">
              #{booking.id}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black">{booking.customerName}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {booking.eventDate} at {formatTime(booking.eventStartTime)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <BookingInvoiceButton kind="rental" bookingId={booking.id} />
          {canCollectPayment ? (
            <BookingPaymentButton
              bookingId={booking.id}
              kind="rental"
              customerEmail={booking.customerEmail}
              balanceCents={paymentProjection.balanceCents}
            />
          ) : null}
          {(booking.status === "pending" || booking.status === "approved") && (
            <RentalEditButton booking={booking} />
          )}
          {booking.status === "pending" && (
            <>
              <BookingActionButton
                action="confirm"
                endpoint={actionHref(booking.id, "confirm")}
                label="Confirm"
                tone="confirm"
              />
              <BookingActionButton
                action="reject"
                endpoint={actionHref(booking.id, "reject")}
                label="Reject"
                tone="reject"
              />
            </>
          )}
          {(booking.status === "pending" || booking.status === "approved") && (
            <RentalCancellationButton
              endpoint={actionHref(booking.id, "cancel")}
              customerName={booking.customerName}
              eventDate={booking.eventDate}
              spanDays={booking.spanDays}
              itemNames={booking.items.map((item) => item.rental_name)}
              currentStatus={booking.status}
            />
          )}
          {(booking.status === "cancelled" ||
            booking.status === "canceled") && (
            <RentalRestoreButton
              bookingId={booking.id}
              customerName={booking.customerName}
              eventDate={booking.eventDate}
              itemNames={booking.items.map((item) => item.rental_name)}
            />
          )}
          {(booking.status === "cancelled" || booking.status === "canceled") &&
            (booking.googleCalendarEventId ||
              booking.googleCalendarSecondaryEventId ||
              booking.googleFoamCalendarEventId) && (
              <RentalCancellationButton
                endpoint={actionHref(booking.id, "cancel")}
                customerName={booking.customerName}
                eventDate={booking.eventDate}
                spanDays={booking.spanDays}
                itemNames={booking.items.map((item) => item.rental_name)}
                currentStatus={booking.status}
                retryCalendarOnly
              />
            )}
          {booking.singleStopMapUrl && (
            <a
              href={booking.singleStopMapUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-amber-950 hover:bg-amber-200"
            >
              Route
            </a>
          )}
        </div>
      </div>

      <RentalAgreementPanel bookingId={booking.id} customerName={booking.customerName} customerEmail={booking.customerEmail} history={agreements} editable={booking.status === "pending" || booking.status === "approved"} />
      <div className="compact-print-columns mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-sky-700">
            Rental Order
          </h3>
          <ul className="mt-3 space-y-2">
            {booking.items.map((item) => (
              <li
                key={`${item.rental_item}-${item.rental_name}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
              >
                {item.rental_name}
              </li>
            ))}
          </ul>
          <div className="compact-print-detail-grid mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Duration" value={booking.dayCharges === null ? booking.duration ?? "Standard" : `${booking.spanDays} ${booking.spanDays === 1 ? "day" : "days"}`} />
            {booking.foamDuration &&
              booking.foamDuration !== booking.duration && (
                <Detail label="Foam time" value={booking.foamDuration} />
              )}
            <Detail label="Reserved period" value={              `${booking.eventDate} through ${rentalDatePlusDays(booking.eventDate, booking.spanDays - 1)} (${booking.spanDays} days)`} />
            {booking.dayCharges?.map(day => <Detail key={day.day} label={`Day ${day.day}`} value={day.choice === "free" ? "Free ($0.00)" : `Charge $${day.amount.toFixed(2)}`} />)}
            <Detail
              label="Delivery window"
              value={booking.requestedDeliveryWindow ?? "Not set"}
            />
            <Detail
              label="Calendar"
              value={
                booking.googleCalendarEventId ||
                booking.googleFoamCalendarEventId
                  ? "Created"
                  : "Not created"
              }
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-sky-700">
            Customer and Setup
          </h3>
          <div className="compact-print-detail-grid mt-3 grid gap-3">
            <Detail label="Phone" value={booking.customerPhone ? <a href={`tel:${booking.customerPhone}`} className="text-cyan-900 underline">{booking.customerPhone}</a> : "Not set"} />
            <Detail label="Email" value={booking.customerEmail ? <a href={`mailto:${booking.customerEmail}`} className="break-all text-cyan-900 underline">{booking.customerEmail}</a> : "Not set"} />
            <Detail label="Address" value={booking.eventAddress ?? "Not set"} />
            <Detail
              label="Distance"
              value={
                booking.distanceMiles === null
                  ? "Not set"
                  : `${booking.distanceMiles.toFixed(1)} miles`
              }
            />
            <Detail
              label="Location"
              value={booking.setupLocation ?? "Not set"}
            />
            <Detail label="Surface" value={booking.setupSurface ?? "Not set"} />
            <Detail label="Access" value={booking.setupAccess ?? "Not set"} />
            <Detail label="Notes" value={booking.setupNotes ?? "None"} />
          </div>
        </section>
      </div>

      <div className="compact-print-money-grid mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <Detail label="Payment" value={booking.paymentMethod ?? "Not set"} />
        <Detail label="Subtotal" value={formatMoney(booking.subtotal)} />
        <Detail label="Delivery fee" value={formatMoney(booking.deliveryFee)} />
        <Detail label="Total" value={formatMoney(booking.total)} />
      </div>
      <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-emerald-800">
            Payment record
          </h3>
          <p className="text-sm font-black text-emerald-900">
            {paymentStatusLabel(paymentProjection.status)} | Paid{" "}
            {formatCents(paymentProjection.paidCents)}
            {paymentProjection.balanceCents === null
              ? ""
              : ` | Balance ${formatCents(paymentProjection.balanceCents)}`}
          </p>
        </div>
        {booking.paymentEntries.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-600">
            No payments have been recorded for this rental.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {booking.paymentEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm"
              >
                <span className="font-bold text-slate-900">
                  {formatCents(entry.amountCents)} via {entry.paymentMethod}
                  {entry.processingFeeCents > 0
                    ? ` (+${formatCents(entry.processingFeeCents)} fee)`
                    : ""}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {new Date(entry.createdAt).toLocaleString()} |{" "}
                  {receiptAuditLabel(entry)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

export default async function AdminRentalsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const from = resolved?.from ? normalizeYmd(resolved.from) : defaultFromYmd();
  const to = normalizeYmd(resolved?.to) || defaultToYmd(from);
  const status = normalizeStatus(resolved?.status);
  const effectiveTo = resolved?.to ? to : defaultToYmd(from);
  const [{ bookings: loadedBookings }, { summary }] = await Promise.all([
    loadAdminRentalBookings({
      from,
      to: effectiveTo,
      status,
    }),
    loadAdminRentalBookings({
      from,
      to: effectiveTo,
      status: "all",
    }),
  ]);
  const agreementMap = await loadAgreementHistory(loadedBookings.map(b => b.id));
  const search = resolved?.q?.trim().toLowerCase() ?? "";
  const agreementFilter = resolved?.agreement === "unsigned" ? "unsigned" : resolved?.agreement === "attention" ? "attention" : "all";
  const bookings = loadedBookings.filter(b => {
    const agreement = agreementMap.get(b.id)?.[0];
    const state = agreementState(b.customerName, agreement);
    if (agreementFilter === "unsigned" && !canRequestAgreement(b.status, agreement)) return false;
    if (agreementFilter === "attention" && !["missing", "superseded", "failed", "review"].includes(state)) return false;
    return !search || [b.id,b.customerName,b.customerEmail,b.customerPhone,b.eventAddress,...b.items.map(i => i.rental_name)].filter(Boolean).join(" ").toLowerCase().includes(search);
  });
  const formatDate = (ymd: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${ymd}T12:00:00Z`));
  const today = todayYmd(), weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const weekendFrom = rentalDatePlusDays(today, weekday === 0 ? -2 : weekday === 6 ? -1 : (5 - weekday + 7) % 7);
  const weekendTo = rentalDatePlusDays(weekendFrom, 2);
  const weekendQuery = new URLSearchParams({ from: weekendFrom, to: weekendTo, status: "all", ...(token ? { token } : {}) });
  const unsignedCount = loadedBookings.filter(b => canRequestAgreement(b.status, agreementMap.get(b.id)?.[0])).length;
  const baseQuery = `token=${encodeURIComponent(token)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(effectiveTo)}`;
  const pendingApprovalEndpoints = bookings
    .filter((booking) => booking.status === "pending")
    .map((booking) => actionHref(booking.id, "confirm"));

  return (
    <AdminShell>
      <AdminHeader eyebrow="Rental Admin" title="Rental Dashboard">
        <FilterForm
          key={`${from}-${effectiveTo}-${status}`}
          token={token}
          from={from}
          to={effectiveTo}
          status={status}
        />
      </AdminHeader>
      <AdminNav token={token} role={auth.role} active="rentals" />

      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <Link href={`/admin/rentals?${weekendQuery}`} className="rounded-full bg-cyan-800 px-4 py-2 text-sm font-black text-white hover:bg-cyan-900">This weekend · {formatDate(weekendFrom)}–{formatDate(weekendTo)}</Link>
        <Link
          href="/admin/deliveries"
          className="rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-amber-950 hover:bg-amber-200"
        >
          Open Route Planner
        </Link>
        {pendingApprovalEndpoints.length > 0 ? (
          <BulkBookingActionButton
            endpoints={pendingApprovalEndpoints}
            label={`Approve all pending (${pendingApprovalEndpoints.length})`}
          />
        ) : null}
        <PrintButton label="Print booking sheets" />
      </div>

      {auth.role === "owner" ? <RentalAgreementTemplateEditor /> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-sm print:hidden">
        {[{ label: "Waiting approval", count: summary.pending ?? 0, status: "pending" }, { label: "Approved", count: summary.approved ?? 0, status: "approved" }, { label: "Rejected", count: summary.rejected ?? 0, status: "rejected" }, { label: "Cancelled", count: summary.cancelled ?? 0, status: "cancelled" }].map(item => <Link key={item.status} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:border-cyan-500" href={`/admin/rentals?${baseQuery}&status=${item.status}`}>{item.label} <span className="ml-1 font-black text-slate-950">{item.count}</span></Link>)}
        <Link className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-950" href={`/admin/rentals?${baseQuery}&status=${status}&agreement=unsigned`}>Unsigned agreements <span className="ml-1 font-black">{unsignedCount}</span></Link>
      </div>
      <form action="/admin/rentals" className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto] print:hidden">
        <input type="hidden" name="token" value={token} /><input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={effectiveTo} /><input type="hidden" name="status" value={status} />
        <label className="text-xs font-bold text-slate-600">Find a rental<input type="search" name="q" defaultValue={resolved?.q ?? ""} placeholder="Customer, rental, city, phone or booking #" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base font-normal text-slate-950" /></label>
        <label className="text-xs font-bold text-slate-600">Agreement status<select name="agreement" defaultValue={agreementFilter} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-950"><option value="all">All agreements</option><option value="unsigned">Unsigned active rentals</option><option value="attention">Needs attention</option></select></label>
        <button className="min-h-11 self-end rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Apply</button>
      </form>
      <RentalAgreementBatch bookings={bookings.map(b => ({ id: b.id, customerName: b.customerName, customerEmail: b.customerEmail, eventDate: b.eventDate, rentalNames: productSummary(b.items.map(i => i.rental_name)), city: cityFromAddress(b.eventAddress), status: b.status, agreement: agreementMap.get(b.id)?.[0] }))} />
      <p className="mt-5 text-sm font-semibold text-slate-600 print:hidden">{bookings.length} rentals shown · Click a square to expand all booking details.</p>
      <div className="mt-3 grid items-start gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 print:hidden">
        {bookings.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold">No rentals found.</p>
            <p className="mt-2 text-sm text-slate-600">
              Adjust the date range or status filter.
            </p>
          </div>
        ) : (
          bookings.map((booking) => {
            const state = agreementState(booking.customerName, agreementMap.get(booking.id)?.[0]);
            const tone = state === "signed" ? "bg-emerald-100 text-emerald-900" : state === "failed" ? "bg-rose-100 text-rose-900" : state === "awaiting" ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-950";
            return <RentalBookingSquare key={booking.id} id={booking.id} rentalNames={productSummary(booking.items.map(i => i.rental_name))} city={cityFromAddress(booking.eventAddress)} date={booking.spanDays > 1 ? `${formatDate(booking.eventDate)}–${formatDate(rentalDatePlusDays(booking.eventDate, booking.spanDays - 1))}` : formatDate(booking.eventDate)} customerName={booking.customerName} bookingStatus={<StatusBadge status={booking.status} />} agreementLabel={agreementStateLabel[state]} agreementTone={tone}>
              <RentalCard booking={booking} agreements={(agreementMap.get(booking.id) ?? []).map(a => ({ ...a, path: customerAgreementPath(a.id) }))} />
            </RentalBookingSquare>;
          })
        )}
      </div>
      <div className="hidden print:grid print:gap-4">{bookings.map(booking => <RentalCard key={booking.id} booking={booking} agreements={[]} />)}</div>
    </AdminShell>
  );
}
