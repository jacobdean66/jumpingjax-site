import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  defaultFromYmd,
  defaultToYmd,
  loadAdminRentalBookings,
  normalizeStatus,
  normalizeYmd,
  type AdminRentalBooking,
} from "@/lib/admin/operations";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
  FilterForm,
  StatTile,
  StatusBadge,
} from "../_components";
import { PrintButton } from "../PrintButton";
import { BookingActionButton } from "../BookingActionButton";
import { BulkBookingActionButton } from "../BulkBookingActionButton";
import { RentalCancellationButton } from "./RentalCancellationButton";
import { RentalRestoreButton } from "./RentalRestoreButton";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    from?: string;
    to?: string;
    status?: string;
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

function RentalCard({ booking }: { booking: AdminRentalBooking }) {
  return (
    <article
      id={`booking-${booking.id}`}
      className="compact-print-card scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid print:border-slate-900 print:shadow-none"
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
          {(booking.status === "cancelled" || booking.status === "canceled") &&
            <RentalRestoreButton
              bookingId={booking.id}
              customerName={booking.customerName}
              eventDate={booking.eventDate}
              itemNames={booking.items.map((item) => item.rental_name)}
            />}
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
            <Detail label="Duration" value={booking.duration ?? "Standard"} />
            <Detail label="Span" value={`${booking.spanDays} day(s)`} />
            <Detail
              label="Delivery window"
              value={booking.requestedDeliveryWindow ?? "Not set"}
            />
            <Detail
              label="Calendar"
              value={
                booking.googleCalendarEventId || booking.googleFoamCalendarEventId
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
            <Detail label="Phone" value={booking.customerPhone ?? "Not set"} />
            <Detail label="Email" value={booking.customerEmail ?? "Not set"} />
            <Detail label="Address" value={booking.eventAddress ?? "Not set"} />
            <Detail
              label="Distance"
              value={
                booking.distanceMiles === null
                  ? "Not set"
                  : `${booking.distanceMiles.toFixed(1)} miles`
              }
            />
            <Detail label="Location" value={booking.setupLocation ?? "Not set"} />
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
  const [{ bookings }, { summary }] = await Promise.all([
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        <StatTile
          label="Waiting approval"
          value={summary.pending ?? 0}
          href={`/admin/rentals?${baseQuery}&status=pending`}
        />
        <StatTile
          label="Approved rentals"
          value={summary.approved ?? 0}
          href={`/admin/rentals?${baseQuery}&status=approved`}
        />
        <StatTile
          label="Rejected rentals"
          value={summary.rejected ?? 0}
          href={`/admin/rentals?${baseQuery}&status=rejected`}
        />
        <StatTile
          label="Cancelled rentals"
          value={summary.cancelled ?? 0}
          href={`/admin/rentals?${baseQuery}&status=cancelled`}
        />
      </div>

      <div className="mt-8 grid gap-5">
        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold">No rentals found.</p>
            <p className="mt-2 text-sm text-slate-600">
              Adjust the date range or status filter.
            </p>
          </div>
        ) : (
          bookings.map((booking) => (
            <RentalCard key={booking.id} booking={booking} />
          ))
        )}
      </div>
    </AdminShell>
  );
}
