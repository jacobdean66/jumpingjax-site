import Link from "next/link";
import { loadAdminDeliveries, normalizeDeliveryDate, todayYmd, type AdminDeliveryBooking } from "@/lib/admin/deliveries";
import { closeoutKey, loadDriverCloseoutReports, type DriverCloseoutReport } from "@/lib/admin/driver-closeout";
import { verifyAdminAccess } from "@/lib/admin/session";
import { PrintButton } from "../PrintButton";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    date?: string;
  }>;
};

const TRUCKS = [
  { id: "truck-1", label: "Truck 1" },
  { id: "truck-2", label: "Truck 2" },
  { id: "unassigned", label: "Unassigned" },
] as const;
const SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

function formatTime(value: string | null): string {
  if (!value) return "Not set";
  const [hourRaw, minuteRaw] = value.split(":").map(Number);
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return value;
  const hour = hourRaw % 12 || 12;
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  return `${hour}:${String(minuteRaw).padStart(2, "0")} ${suffix}`;
}

function bookingTruck(booking: AdminDeliveryBooking): string {
  return (
    booking.deliveryTruck ??
    booking.items.find((item) => item.deliveryTruck)?.deliveryTruck ??
    "unassigned"
  );
}

function bookingSequence(booking: AdminDeliveryBooking): number {
  const itemSequence = booking.items
    .map((item) => item.deliverySequence)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b)[0];
  return booking.deliverySequence ?? itemSequence ?? 999;
}

function bookingStatus(booking: AdminDeliveryBooking): string {
  return (
    booking.deliveryRouteStatus ??
    booking.items.find((item) => item.deliveryRouteStatus)?.deliveryRouteStatus ??
    "planned"
  );
}

function routeEmbedUrl(bookings: AdminDeliveryBooking[]): string | null {
  const seen = new Set<string>();
  const stops = bookings
    .map((booking) => booking.eventAddress?.trim())
    .filter((address): address is string => {
      if (!address || seen.has(address)) return false;
      seen.add(address);
      return true;
    });
  if (stops.length === 0) return null;

  const url = new URL("https://maps.google.com/maps");
  url.searchParams.set("f", "d");
  url.searchParams.set("source", "s_d");
  url.searchParams.set("saddr", SHOP_ADDRESS);
  url.searchParams.set("daddr", stops.join(" to: "));
  url.searchParams.set("output", "embed");
  return url.toString();
}

function issueLabels(report?: DriverCloseoutReport): string[] {
  if (!report) return [];
  return [
    report.outOfSlideSpray ? "Out of slide spray" : null,
    report.cashPayment ? "Cash" : null,
    report.creditPayment ? "Credit" : null,
    report.paid ? "Paid" : null,
    report.unpaid ? "Unpaid" : null,
    report.boughtGas ? "Bought gas" : null,
    report.boughtDrinks ? "Bought drinks" : null,
    report.customerHappy ? "Customer happy" : null,
    report.damageIssue ? "Damage/cleaning" : null,
    report.missingItemIssue ? "Missing item" : null,
    report.customerIssue ? "Customer/payment" : null,
    report.siteAccessIssue ? "Site/access" : null,
    report.latePickupIssue ? "Late pickup" : null,
    report.officeFollowupNeeded ? "Office follow-up" : null,
  ].filter((item): item is string => Boolean(item));
}

function dayHref(date: string, token: string): string {
  const params = new URLSearchParams({ date });
  if (token) params.set("token", token);
  return `/admin/end-of-day?${params.toString()}`;
}

function StopRow({
  booking,
  report,
}: {
  booking: AdminDeliveryBooking;
  report?: DriverCloseoutReport;
}) {
  const issues = issueLabels(report);
  return (
    <article className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-none print:border-slate-300 print:shadow-none">
      <div className="grid gap-3 lg:grid-cols-[5rem_1.2fr_1fr_1.4fr]">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Stop</p>
          <p className="text-2xl font-black">{bookingSequence(booking) === 999 ? "-" : bookingSequence(booking)}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Customer</p>
          <h3 className="text-lg font-black">{booking.customerName}</h3>
          <p className="text-sm font-semibold text-slate-600">{booking.customerPhone ?? "No phone"}</p>
          <p className="text-sm text-slate-600">{booking.eventAddress ?? "No address"}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Status</p>
          <p className="text-sm font-black">{bookingStatus(booking)}</p>
          <p className="mt-1 text-sm text-slate-600">Start {formatTime(booking.eventStartTime)}</p>
          <p className="text-sm text-slate-600">Pickup {booking.paymentConfirmedAt ? "payment confirmed" : "payment not confirmed"}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Driver closeout</p>
          {report ? (
            <>
              <p className="text-sm font-semibold text-slate-700">
                Saved by {report.driverName ?? "driver"}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-950">
                {issues.length > 0 ? issues.join(", ") : "No issues selected"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {report.notes ?? "No notes"}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-amber-700">No closeout saved yet</p>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-700">
        <span className="font-black">Items:</span>{" "}
        {booking.items.map((item) => item.rental_name).join(", ")}
      </div>
    </article>
  );
}

export default async function AdminEndOfDayPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const date = normalizeDeliveryDate(resolved?.date ?? todayYmd());
  const [deliveries, closeouts] = await Promise.all([
    loadAdminDeliveries(date),
    loadDriverCloseoutReports({ date }),
  ]);
  const closeoutByStop = new Map(
    closeouts.map((report) => [closeoutKey(report.bookingId, report.truck), report]),
  );
  const completed = deliveries.bookings.filter((booking) => bookingStatus(booking) === "picked-up").length;
  const issueCount = closeouts.filter((report) => issueLabels(report).length > 0 || report.notes).length;
  const overviewMap = routeEmbedUrl(deliveries.bookings);

  return (
    <AdminShell>
      <AdminHeader eyebrow="Operations" title="End of Day">
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Print Report" />
          <Link
            href={`/driver?token=${encodeURIComponent(token)}&date=${date}`}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"
          >
            Open Driver App
          </Link>
        </div>
      </AdminHeader>
      <AdminNav token={token} role={auth.role} active="end-of-day" />

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="token" value={token} />
          <label className="text-sm font-bold text-slate-700">
            Report date
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
            />
          </label>
          <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white">
            Load Report
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
          <Link href={dayHref(addDays(date, -1), token)} className="rounded-full border border-slate-200 px-4 py-2">
            Previous Day
          </Link>
          <Link href={dayHref(todayYmd(), token)} className="rounded-full bg-slate-950 px-4 py-2 text-white">
            Today
          </Link>
          <Link href={dayHref(addDays(date, 1), token)} className="rounded-full border border-slate-200 px-4 py-2">
            Next Day
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Jumping Jax Operations
            </p>
            <h2 className="mt-1 text-3xl font-black">End-of-Day Report</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">{formatDate(date)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="font-black">{deliveries.bookings.length}</p>
              <p className="text-xs font-bold text-slate-600">Stops</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="font-black">{completed}</p>
              <p className="text-xs font-bold text-slate-600">Picked Up</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="font-black">{issueCount}</p>
              <p className="text-xs font-bold text-slate-600">Issues</p>
            </div>
          </div>
        </div>

        {overviewMap ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white print:hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Overview map
              </p>
              <p className="text-sm font-bold text-slate-700">
                All active rental stops for this report date.
              </p>
            </div>
            <iframe
              title="End-of-day overview map"
              src={overviewMap}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-80 w-full border-0"
            />
          </div>
        ) : null}

        <div className="mt-5 grid gap-6">
          {TRUCKS.map((truck) => {
            const bookings = deliveries.bookings
              .filter((booking) => bookingTruck(booking) === truck.id)
              .sort((a, b) => bookingSequence(a) - bookingSequence(b));
            return (
              <section key={truck.id} className="break-inside-avoid">
                <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-2xl font-black">{truck.label}</h3>
                  <p className="text-sm font-bold text-slate-600">{bookings.length} stops</p>
                </div>
                {bookings.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                    No stops assigned.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {bookings.map((booking) => (
                      <StopRow
                        key={booking.id}
                        booking={booking}
                        report={closeoutByStop.get(closeoutKey(booking.id, truck.id))}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}
