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
  StatTile,
  StatusBadge,
} from "../_components";
import { PrintButton } from "../PrintButton";
import { BookingActionButton } from "../BookingActionButton";
import { BulkBookingActionButton } from "../BulkBookingActionButton";
import { RentalCancellationButton } from "./RentalCancellationButton";
import { RentalEditButton } from "./RentalEditButton";
import { RentalRestoreButton } from "./RentalRestoreButton";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    from?: string;
    to?: string;
    status?: string;
    q?: string;
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

function cityFromAddress(value: string | null): string {
  if (!value) return "Not set";
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2] ?? "Not set";

  const cityMatch = value.match(
    /\b([A-Za-z][A-Za-z\s.'-]+)\s*,?\s+[A-Z]{2}\b/,
  );
  return cityMatch?.[1]?.trim() || "Not set";
}

function bookedInflatables(booking: AdminRentalBooking): string {
  return booking.items.map((item) => item.rental_name).join(", ") || "Rental";
}

function normalizeSearch(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function matchesRentalSearch(
  booking: AdminRentalBooking,
  search: string,
): boolean {
  if (!search) return true;
  const searchableText = [
    booking.id,
    booking.customerName,
    booking.customerEmail,
    booking.customerPhone,
    booking.eventDate,
    booking.eventAddress,
    cityFromAddress(booking.eventAddress),
    bookedInflatables(booking),
    booking.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(search);
}

function compareRentalPriority(
  today: string,
  left: AdminRentalBooking,
  right: AdminRentalBooking,
): number {
  const leftUpcoming = left.eventDate >= today;
  const rightUpcoming = right.eventDate >= today;
  if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;

  const dateDirection = leftUpcoming ? 1 : -1;
  const dateCompare = left.eventDate.localeCompare(right.eventDate);
  if (dateCompare !== 0) return dateCompare * dateDirection;

  return (left.eventStartTime ?? "99:99").localeCompare(
    right.eventStartTime ?? "99:99",
  );
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
      className="compact-print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid print:border-slate-900 print:shadow-none"
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
            {booking.foamDuration &&
              booking.foamDuration !== booking.duration && (
                <Detail label="Foam time" value={booking.foamDuration} />
              )}
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

function RentalExpandableCard({ booking }: { booking: AdminRentalBooking }) {
  return (
    <details
      id={`booking-${booking.id}`}
      className="group scroll-mt-24 relative overflow-hidden rounded-lg border-2 border-amber-400/70 bg-slate-900 text-white shadow-lg shadow-black/40 transition hover:border-yellow-300 hover:shadow-yellow-300/30 open:col-span-full open:border-amber-300/90 open:bg-slate-950 open:shadow-xl"
    >
      <summary className="relative flex aspect-square cursor-pointer list-none flex-col justify-between rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-2 transition hover:from-slate-800 hover:to-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 group-open:aspect-auto group-open:border group-open:border-amber-200/80 group-open:bg-slate-950 group-open:shadow-sm [&::-webkit-details-marker]:hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1 right-1 top-2 h-1 bg-amber-300/40" />
          <div className="absolute left-2 right-2 top-1/2 h-1 bg-amber-300/25" />
        </div>
        <div className="relative">
          <div className="flex items-center justify-between gap-1">
            <StatusBadge status={booking.status} />
            <span className="rounded-full border border-amber-300/90 bg-black/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100 group-open:border-yellow-300 group-open:bg-black/50 group-open:text-yellow-100">
              <span className="group-open:hidden">Open</span>
              <span className="hidden group-open:inline">Close</span>
            </span>
          </div>
          <h2 className="mt-2 inline-block rounded-md border border-amber-200/70 bg-black/35 px-1.5 py-1 text-sm font-black leading-tight tracking-wide text-amber-100 shadow-inner shadow-amber-200/20">
            {bookedInflatables(booking)}
          </h2>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-black uppercase tracking-wide text-yellow-200/90">
            Date
          </p>
          <p className="text-[11px] font-black text-white">
            {booking.eventDate}
          </p>
          <p className="truncate text-[11px] font-semibold text-slate-100">
            {cityFromAddress(booking.eventAddress)}
          </p>
          <p className="text-[10px] font-semibold tracking-wide text-yellow-100">
            Tap to expand • Keep your cargo upright
          </p>
        </div>
      </summary>
      <div className="mt-2 rounded-b-lg border-t border-amber-300/40 bg-slate-950 p-3">
        <RentalCard booking={booking} />
      </div>
    </details>
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
  const rentalSearch = normalizeSearch(resolved?.q);
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
  const bookings = loadedBookings
    .filter((booking) => matchesRentalSearch(booking, rentalSearch))
    .sort((left, right) => compareRentalPriority(todayYmd(), left, right));
  const searchQuery = rentalSearch
    ? `&q=${encodeURIComponent(rentalSearch)}`
    : "";
  const baseQuery = `token=${encodeURIComponent(token)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(effectiveTo)}${searchQuery}`;
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
        <Link
          href="/admin/routes-history"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          Routes History
        </Link>
        {pendingApprovalEndpoints.length > 0 ? (
          <BulkBookingActionButton
            endpoints={pendingApprovalEndpoints}
            label={`Approve all pending (${pendingApprovalEndpoints.length})`}
          />
        ) : null}
        <PrintButton label="Print booking sheets" />
      </div>

      <form
        action="/admin/rentals"
        className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center print:hidden"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="to" value={effectiveTo} />
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={rentalSearch}
          placeholder="Search rentals"
          className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
          >
            Search
          </button>
          {rentalSearch && (
            <Link
              href={`/admin/rentals?token=${encodeURIComponent(token)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(effectiveTo)}&status=${encodeURIComponent(status)}`}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mt-4 grid [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] gap-2 print:hidden">
        {bookings.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold">No rentals found.</p>
            <p className="mt-2 text-sm text-slate-600">
              Adjust the date range or status filter.
            </p>
          </div>
        ) : (
          bookings.map((booking) => (
            <RentalExpandableCard key={booking.id} booking={booking} />
          ))
        )}
      </div>

      {bookings.length > 0 && (
        <div className="mt-8 hidden gap-5 print:grid">
          {bookings.map((booking) => (
            <div key={booking.id}>
              <RentalCard booking={booking} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
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
    </AdminShell>
  );
}
