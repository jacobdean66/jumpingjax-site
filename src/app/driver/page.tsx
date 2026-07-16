import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { AdminBackButton } from "@/app/admin/AdminBackButton";
import {
  loadAdminDeliveries,
  normalizeDeliveryDate,
  todayYmd,
  type AdminDeliveryBooking,
} from "@/lib/admin/deliveries";
import {
  closeoutKey,
  loadDriverCloseoutReports,
  type DriverCloseoutReport,
} from "@/lib/admin/driver-closeout";
import { DriverAutoRefresh } from "./DriverAutoRefresh";
import { DriverAssignmentPrintButtons } from "./DriverAssignmentPrintButtons";
import { PrintButton } from "@/app/admin/PrintButton";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    date?: string;
    truck?: string;
    message?: string;
    error?: string;
  }>;
};

const SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";
const TRUCKS = [
  { id: "truck-1", label: "Short Trailer" },
  { id: "truck-2", label: "Long Trailer" },
] as const;

function truckLabel(truck: string): string {
  return TRUCKS.find((item) => item.id === truck)?.label ?? truck;
}

function normalizeTruck(value: string | null | undefined): string | null {
  const clean = value?.trim().toLowerCase();
  if (!clean) return null;
  if (clean === "truck-1" || clean === "truck 1" || clean === "1" || clean === "short") return "truck-1";
  if (clean === "truck-2" || clean === "truck 2" || clean === "2" || clean === "long") return "truck-2";
  return null;
}

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
    month: "short",
    day: "numeric",
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

function formatMoney(value: number | null): string {
  if (typeof value !== "number") return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function directionsUrl(address: string | null): string | null {
  if (!address) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", SHOP_ADDRESS);
  url.searchParams.set("destination", address);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function nextStopDirectionsUrl({
  currentBooking,
  truckBookings,
}: {
  currentBooking: AdminDeliveryBooking;
  truckBookings: AdminDeliveryBooking[];
}): string | null {
  const ordered = truckBookings
    .filter((booking) => booking.eventAddress?.trim())
    .sort((a, b) => {
      const sequence = bookingSequence(a) - bookingSequence(b);
      if (sequence !== 0) return sequence;
      return (a.eventStartTime ?? "99:99").localeCompare(
        b.eventStartTime ?? "99:99",
      );
    });
  const currentIndex = ordered.findIndex((booking) => booking.id === currentBooking.id);
  const next = currentIndex >= 0 ? ordered[currentIndex + 1] : ordered[0];
  const destination = next?.eventAddress?.trim();
  const origin = currentBooking.eventAddress?.trim() || SHOP_ADDRESS;

  if (!destination) {
    return directionsUrl(SHOP_ADDRESS);
  }

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function nextStopBooking({
  currentBooking,
  truckBookings,
}: {
  currentBooking: AdminDeliveryBooking;
  truckBookings: AdminDeliveryBooking[];
}): AdminDeliveryBooking | null {
  const ordered = truckBookings
    .filter((booking) => booking.eventAddress?.trim())
    .sort((a, b) => {
      const sequence = bookingSequence(a) - bookingSequence(b);
      if (sequence !== 0) return sequence;
      return (a.eventStartTime ?? "99:99").localeCompare(
        b.eventStartTime ?? "99:99",
      );
    });
  const currentIndex = ordered.findIndex((booking) => booking.id === currentBooking.id);
  return currentIndex >= 0 ? ordered[currentIndex + 1] ?? null : ordered[0] ?? null;
}

function routeUrl(bookings: AdminDeliveryBooking[]): string | null {
  const stops = bookings
    .map((booking) => booking.eventAddress?.trim())
    .filter((address): address is string => Boolean(address));
  if (stops.length === 0) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", SHOP_ADDRESS);
  url.searchParams.set("destination", stops[stops.length - 1]!);
  if (stops.length > 1) {
    url.searchParams.set("waypoints", stops.slice(0, -1).join("|"));
  }
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function routeEmbedUrl(bookings: AdminDeliveryBooking[]): string | null {
  const stops = bookings
    .map((booking) => booking.eventAddress?.trim())
    .filter((address): address is string => Boolean(address));
  if (stops.length === 0) return null;

  const url = new URL("https://maps.google.com/maps");
  url.searchParams.set("f", "d");
  url.searchParams.set("source", "s_d");
  url.searchParams.set("saddr", SHOP_ADDRESS);
  url.searchParams.set("daddr", stops.join(" to: "));
  url.searchParams.set("output", "embed");
  return url.toString();
}

function phoneHref(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, "");
  return digits ? `tel:${digits}` : null;
}

function textHref(phone: string | null, message?: string): string | null {
  const digits = phone?.replace(/\D/g, "");
  if (!digits) return null;
  const body = message?.trim();
  return body ? `sms:${digits}?&body=${encodeURIComponent(body)}` : `sms:${digits}`;
}

function bookingTruck(booking: AdminDeliveryBooking): string {
  return (
    booking.deliveryTruck ??
    booking.items.find((item) => item.deliveryTruck)?.deliveryTruck ??
    "Unassigned"
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

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    planned: "Planned",
    "on-the-way": "On the way",
    delivered: "Delivered",
    "setup-complete": "Setup complete",
    "picked-up": "Picked up",
  };
  return labels[status] ?? status;
}

function statusClasses(status: string): string {
  if (status === "setup-complete" || status === "picked-up") {
    return "border-emerald-200 bg-emerald-100 text-emerald-950";
  }
  if (status === "on-the-way" || status === "delivered") {
    return "border-sky-200 bg-sky-100 text-sky-950";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function customerTextMessage(booking: AdminDeliveryBooking): string {
  return [
    `Hi ${booking.customerName}, this is Jumping Jax.`,
    "We are reaching out about your rental delivery today.",
    booking.eventAddress ? `Address: ${booking.eventAddress}` : null,
    "Reply here or call 864-933-1420 if you need us.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function groupByTruck(bookings: AdminDeliveryBooking[]) {
  const groups = new Map<string, AdminDeliveryBooking[]>();
  for (const booking of bookings) {
    const itemsByTruck = new Map<string, typeof booking.items>();
    for (const item of booking.items) {
      const truck = item.deliveryTruck ?? booking.deliveryTruck ?? "Unassigned";
      itemsByTruck.set(truck, [...(itemsByTruck.get(truck) ?? []), item]);
    }

    if (itemsByTruck.size === 0) {
      const truck = bookingTruck(booking);
      groups.set(truck, [...(groups.get(truck) ?? []), booking]);
      continue;
    }

    for (const [truck, items] of itemsByTruck.entries()) {
      const truckBooking = {
        ...booking,
        items,
        deliveryTruck: truck === "Unassigned" ? null : truck,
        deliverySequence:
          items
            .map((item) => item.deliverySequence)
            .filter((value): value is number => typeof value === "number")
            .sort((a, b) => a - b)[0] ?? booking.deliverySequence,
        plannedArrivalTime:
          items.find((item) => item.plannedArrivalTime)?.plannedArrivalTime ??
          booking.plannedArrivalTime,
        plannedSetupStart:
          items.find((item) => item.plannedSetupStart)?.plannedSetupStart ??
          booking.plannedSetupStart,
        plannedSetupEnd:
          items.find((item) => item.plannedSetupEnd)?.plannedSetupEnd ??
          booking.plannedSetupEnd,
        deliveryRouteStatus:
          items.find((item) => item.deliveryRouteStatus)?.deliveryRouteStatus ??
          booking.deliveryRouteStatus,
      };
      groups.set(truck, [...(groups.get(truck) ?? []), truckBooking]);
    }
  }
  return [...groups.entries()]
    .map(([truck, truckBookings]) => ({
      truck,
      bookings: truckBookings.sort((a, b) => {
        const sequence = bookingSequence(a) - bookingSequence(b);
        if (sequence !== 0) return sequence;
        return (a.eventStartTime ?? "99:99").localeCompare(
          b.eventStartTime ?? "99:99",
        );
      }),
    }))
    .sort((a, b) => a.truck.localeCompare(b.truck));
}

function bookingTrailerLoad(booking: AdminDeliveryBooking): number {
  return (
    booking.items
      .map((item) => item.trailerLoad)
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b)[0] ?? 1
  );
}

function groupByTrailerLoad(bookings: AdminDeliveryBooking[]) {
  const groups = new Map<number, AdminDeliveryBooking[]>();

  for (const booking of bookings) {
    const itemsByLoad = new Map<number, typeof booking.items>();
    for (const item of booking.items) {
      const load = item.trailerLoad ?? bookingTrailerLoad(booking);
      itemsByLoad.set(load, [...(itemsByLoad.get(load) ?? []), item]);
    }

    for (const [load, items] of itemsByLoad.entries()) {
      const loadBooking = {
        ...booking,
        items,
        deliverySequence:
          items
            .map((item) => item.deliverySequence)
            .filter((value): value is number => typeof value === "number")
            .sort((a, b) => a - b)[0] ?? booking.deliverySequence,
        plannedArrivalTime:
          items.find((item) => item.plannedArrivalTime)?.plannedArrivalTime ??
          booking.plannedArrivalTime,
      };
      groups.set(load, [...(groups.get(load) ?? []), loadBooking]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([load, loadBookings]) => ({
      load,
      bookings: loadBookings.sort((a, b) => {
        const sequence = bookingSequence(a) - bookingSequence(b);
        if (sequence !== 0) return sequence;
        return (a.eventStartTime ?? "99:99").localeCompare(
          b.eventStartTime ?? "99:99",
        );
      }),
    }));
}

function DriverPrintSheets({
  groups,
  date,
}: {
  groups: { truck: string; bookings: AdminDeliveryBooking[] }[];
  date: string;
}) {
  const assignments = groups.flatMap((group) =>
    groupByTrailerLoad(group.bookings).map((loadGroup) => ({
      truck: group.truck,
      load: loadGroup.load,
      bookings: loadGroup.bookings,
    })),
  );

  if (assignments.length === 0) {
    return (
      <section className="driver-print-only">
        <h1>Jumping Jax Driver Sheet</h1>
        <p>{formatDate(date)}</p>
        <p>No assigned stops for this selection.</p>
      </section>
    );
  }

  return (
    <section className="driver-print-only">
      {assignments.map((assignment, index) => (
        <article
          key={`${assignment.truck}-${assignment.load}`}
          id={`driver-sheet-${assignment.truck}-load-${assignment.load}`}
          className={`driver-print-sheet${index > 0 ? " driver-print-sheet-break" : ""}`}
        >
          <header className="driver-print-sheet-head">
            <div>
              <h1>Jumping Jax Driver Sheet</h1>
              <p>{formatDate(date)}</p>
            </div>
            <div>
              <p>
                <strong>Driver / Truck:</strong> {truckLabel(assignment.truck)}
              </p>
              <p>
                <strong>Trailer load:</strong>{" "}
                {assignment.load == null ? "Unassigned" : `Load ${assignment.load}`}
              </p>
              <p>
                <strong>Stops:</strong> {assignment.bookings.length}
              </p>
            </div>
          </header>
          <table className="driver-print-table">
            <thead>
              <tr>
                <th>Stop</th>
                <th>Times</th>
                <th>Customer / Address</th>
                <th>Products</th>
                <th>Setup / Notes</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {assignment.bookings.map((booking) => (
                <tr key={`${assignment.truck}-${assignment.load}-${booking.id}`}>
                  <td>
                    {bookingSequence(booking) === 999
                      ? "Unassigned"
                      : bookingSequence(booking)}
                  </td>
                  <td>
                    <p>
                      <strong>Arrive:</strong>{" "}
                      {formatTime(booking.plannedArrivalTime)}
                    </p>
                    <p>
                      <strong>Party:</strong> {formatTime(booking.eventStartTime)}
                    </p>
                    <p>
                      <strong>Window:</strong>{" "}
                      {booking.requestedDeliveryWindow ?? "Not set"}
                    </p>
                  </td>
                  <td>
                    <p>
                      <strong>{booking.customerName}</strong>
                    </p>
                    <p>{booking.customerPhone ?? "No phone"}</p>
                    <p>{booking.eventAddress ?? "No address"}</p>
                  </td>
                  <td>
                    {booking.items.length === 0 ? (
                      <p>No products listed</p>
                    ) : (
                      booking.items.map((item) => (
                        <p key={item.id}>{item.rental_name}</p>
                      ))
                    )}
                  </td>
                  <td>
                    <p>
                      <strong>Location:</strong>{" "}
                      {booking.setupLocation ?? "Not set"}
                    </p>
                    <p>
                      <strong>Surface:</strong> {booking.setupSurface ?? "Not set"}
                    </p>
                    <p>
                      <strong>Access:</strong> {booking.setupAccess ?? "Not set"}
                    </p>
                    <p>
                      <strong>Setup:</strong> {booking.setupNotes ?? "None"}
                    </p>
                    {booking.deliveryRouteNotes ? (
                      <p>
                        <strong>Driver:</strong> {booking.deliveryRouteNotes}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <p>
                      <strong>Pay:</strong> {booking.paymentMethod ?? "Not set"}
                    </p>
                    <p>
                      <strong>Amount due:</strong> {formatMoney(booking.total)}
                    </p>
                    <p>
                      <strong>Status:</strong> {statusLabel(bookingStatus(booking))}
                    </p>
                    {booking.paymentConfirmationNotes ? (
                      <p>
                        <strong>Payment note:</strong>{" "}
                        {booking.paymentConfirmationNotes}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
}

function buildDriverAssignments(
  groups: { truck: string; bookings: AdminDeliveryBooking[] }[],
) {
  return groups.flatMap((group) =>
    groupByTrailerLoad(group.bookings).map((loadGroup) => ({
      truck: group.truck,
      truckLabel: truckLabel(group.truck),
      load: loadGroup.load,
      stopCount: loadGroup.bookings.length,
    })),
  );
}

function DriverStatusButton({
  token,
  date,
  truck,
  bookingId,
  status,
  label,
  tone,
}: {
  token: string;
  date: string;
  truck: string;
  bookingId: string;
  status: string;
  label: string;
  tone: "dark" | "green" | "blue" | "red";
}) {
  const classes = {
    dark: "bg-slate-950 text-white hover:bg-slate-800",
    green: "bg-emerald-500 text-white hover:bg-emerald-600",
    blue: "bg-sky-500 text-white hover:bg-sky-600",
    red: "bg-rose-500 text-white hover:bg-rose-600",
  }[tone];

  return (
    <form action="/api/driver/status" method="post">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="truck" value={truck} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="status" value={status} />
      <button className={`min-h-12 rounded-xl px-4 py-3 text-sm font-black ${classes}`}>
        {label}
      </button>
    </form>
  );
}

function PaymentConfirmForm({
  token,
  date,
  truck,
  booking,
}: {
  token: string;
  date: string;
  truck: string;
  booking: AdminDeliveryBooking;
}) {
  if (booking.paymentConfirmedAt) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        Payment confirmed
        {booking.paymentConfirmedBy ? ` by ${booking.paymentConfirmedBy}` : ""}
      </div>
    );
  }

  return (
    <form action="/api/driver/payment" method="post" className="grid gap-2">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="truck" value={truck} />
      <input type="hidden" name="bookingId" value={booking.id} />
      <input
        name="notes"
        placeholder="Payment note, optional"
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
      />
      <button className="min-h-12 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600">
        Confirm payment received
      </button>
    </form>
  );
}

function CloseoutCheckbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-5 w-5 rounded border-slate-300 text-sky-600"
      />
      {label}
    </label>
  );
}

function CloseoutIssueForm({
  token,
  date,
  truck,
  booking,
  report,
  nextUrl,
  nextBooking,
}: {
  token: string;
  date: string;
  truck: string;
  booking: AdminDeliveryBooking;
  report?: DriverCloseoutReport;
  nextUrl: string | null;
  nextBooking: AdminDeliveryBooking | null;
}) {
  const hasReport = Boolean(report);
  return (
    <form action="/api/driver/closeout" method="post" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="truck" value={truck} />
      <input type="hidden" name="bookingId" value={booking.id} />
      {nextUrl ? <input type="hidden" name="nextUrl" value={nextUrl} /> : null}
      {nextBooking ? (
        <input type="hidden" name="nextBookingId" value={nextBooking.id} />
      ) : null}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Quick checklist
        </p>
        {hasReport ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-950">
            Saved
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <CloseoutCheckbox
          name="outOfSlideSpray"
          label="Out of slide spray"
          defaultChecked={report?.outOfSlideSpray === true}
        />
        <CloseoutCheckbox
          name="cashPayment"
          label="Cash"
          defaultChecked={report?.cashPayment === true}
        />
        <CloseoutCheckbox
          name="creditPayment"
          label="Credit"
          defaultChecked={report?.creditPayment === true}
        />
        <CloseoutCheckbox
          name="paid"
          label="Paid"
          defaultChecked={report?.paid === true || booking.paymentConfirmedAt !== null}
        />
        <CloseoutCheckbox
          name="unpaid"
          label="Unpaid"
          defaultChecked={report?.unpaid === true}
        />
        <CloseoutCheckbox
          name="boughtGas"
          label="Bought gas"
          defaultChecked={report?.boughtGas === true}
        />
        <CloseoutCheckbox
          name="boughtDrinks"
          label="Bought drinks"
          defaultChecked={report?.boughtDrinks === true}
        />
        <CloseoutCheckbox
          name="customerHappy"
          label="Customer happy"
          defaultChecked={report?.customerHappy === true}
        />
        {nextBooking ? (
          <CloseoutCheckbox
            name="notifyNextCustomer"
            label={`Email next customer: ${nextBooking.customerName}`}
            defaultChecked={false}
          />
        ) : null}
        <CloseoutCheckbox
          name="damageIssue"
          label="Damage or cleaning issue"
          defaultChecked={report?.damageIssue === true}
        />
        <CloseoutCheckbox
          name="missingItemIssue"
          label="Missing or forgotten item"
          defaultChecked={report?.missingItemIssue === true}
        />
        <CloseoutCheckbox
          name="customerIssue"
          label="Customer or payment issue"
          defaultChecked={report?.customerIssue === true}
        />
        <CloseoutCheckbox
          name="siteAccessIssue"
          label="Setup or site access issue"
          defaultChecked={report?.siteAccessIssue === true}
        />
        <CloseoutCheckbox
          name="latePickupIssue"
          label="Late pickup or ran behind"
          defaultChecked={report?.latePickupIssue === true}
        />
        <CloseoutCheckbox
          name="officeFollowupNeeded"
          label="Needs office follow-up"
          defaultChecked={report?.officeFollowupNeeded === true}
        />
      </div>
      <textarea
        name="notes"
        defaultValue={report?.notes ?? ""}
        rows={3}
        placeholder="Optional note"
        className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
      />
      <button className="mt-3 min-h-12 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
        Submit and open next map
      </button>
    </form>
  );
}

function StopCard({
  booking,
  token,
  date,
  truck,
  closeout,
  truckBookings,
}: {
  booking: AdminDeliveryBooking;
  token: string;
  date: string;
  truck: string;
  closeout?: DriverCloseoutReport;
  truckBookings: AdminDeliveryBooking[];
}) {
  const status = bookingStatus(booking);
  const call = phoneHref(booking.customerPhone);
  const text = textHref(booking.customerPhone, customerTextMessage(booking));
  const map = directionsUrl(booking.eventAddress);
  const nextMap = nextStopDirectionsUrl({ currentBooking: booking, truckBookings });
  const nextBooking = nextStopBooking({ currentBooking: booking, truckBookings });

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Stop {bookingSequence(booking) === 999 ? "-" : bookingSequence(booking)}
          </p>
          <h3 className="mt-1 text-xl font-black">{booking.customerName}</h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            Party starts {formatTime(booking.eventStartTime)}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(status)}`}
        >
          {statusLabel(status)}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <p>
          <span className="font-black">Arrival:</span>{" "}
          {formatTime(booking.plannedArrivalTime)}
        </p>
        <p>
          <span className="font-black">Window:</span>{" "}
          {booking.requestedDeliveryWindow ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Address:</span>{" "}
          {booking.eventAddress ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Phone:</span>{" "}
          {booking.customerPhone ?? "Not set"}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Items
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold">
          {booking.items.map((item) => (
            <li key={item.id}>{item.rental_name}</li>
          ))}
        </ul>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <p>
          <span className="font-black">Location:</span>{" "}
          {booking.setupLocation ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Surface:</span>{" "}
          {booking.setupSurface ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Access:</span>{" "}
          {booking.setupAccess ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Notes:</span>{" "}
          {booking.setupNotes ?? "None"}
        </p>
        {booking.deliveryRouteNotes ? (
          <p>
            <span className="font-black">Driver notes:</span>{" "}
            {booking.deliveryRouteNotes}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {map ? (
          <a
            href={map}
            target="_blank"
            rel="noreferrer"
            className="min-h-12 rounded-xl bg-amber-300 px-4 py-3 text-center text-sm font-black text-amber-950 hover:bg-amber-200"
          >
            Open Maps
          </a>
        ) : null}
        {call ? (
          <a
            href={call}
            className="min-h-12 rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-black text-white hover:bg-emerald-600"
          >
            Call
          </a>
        ) : null}
        {text ? (
          <a
            href={text}
            className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800 hover:bg-slate-50"
          >
            Text
          </a>
        ) : null}
        <details className="col-span-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800">
          <summary className="cursor-pointer list-none px-4 py-3 text-center font-black hover:bg-slate-50">
            Details
          </summary>
          <div className="grid gap-2 border-t border-slate-200 p-3 text-left">
            <p>
              <span className="font-black">Email:</span>{" "}
              {booking.customerEmail ?? "Not set"}
            </p>
            <p>
              <span className="font-black">Distance:</span>{" "}
              {booking.distanceMiles !== null
                ? `${booking.distanceMiles.toFixed(1)} miles`
                : "Not set"}
            </p>
        <p>
          <span className="font-black">Payment:</span>{" "}
          {booking.paymentMethod ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Payment confirmed:</span>{" "}
          {booking.paymentConfirmedAt ? "Yes" : "No"}
        </p>
            <p>
              <span className="font-black">Total:</span>{" "}
              {booking.total !== null ? `$${booking.total.toFixed(2)}` : "Not set"}
            </p>
            <p>
              <span className="font-black">Setup starts:</span>{" "}
              {formatTime(booking.plannedSetupStart)}
            </p>
            <p>
              <span className="font-black">Setup ends:</span>{" "}
              {formatTime(booking.plannedSetupEnd)}
            </p>
            <Link
              href={`/admin/rentals?token=${encodeURIComponent(token)}&from=${booking.eventDate}&to=${booking.eventDate}&status=all`}
              className="mt-2 rounded-xl bg-slate-950 px-4 py-3 text-center font-black text-white"
            >
              Open full admin details
            </Link>
          </div>
        </details>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Payment
        </p>
        <PaymentConfirmForm
          token={token}
          date={date}
          truck={truck}
          booking={booking}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <DriverStatusButton
          token={token}
          date={date}
          truck={truck}
          bookingId={booking.id}
          status="on-the-way"
          label="Email: on the way"
          tone="blue"
        />
        <DriverStatusButton
          token={token}
          date={date}
          truck={truck}
          bookingId={booking.id}
          status="delivered"
          label="Delivered"
          tone="dark"
        />
        <DriverStatusButton
          token={token}
          date={date}
          truck={truck}
          bookingId={booking.id}
          status="setup-complete"
          label="Setup complete"
          tone="green"
        />
        <DriverStatusButton
          token={token}
          date={date}
          truck={truck}
          bookingId={booking.id}
          status="picked-up"
          label="Pickup complete"
          tone="dark"
        />
      </div>

      <CloseoutIssueForm
        token={token}
        date={date}
        truck={truck}
        booking={booking}
        report={closeout}
        nextUrl={nextMap}
        nextBooking={nextBooking}
      />
    </article>
  );
}

export default async function DriverPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  const date = normalizeDeliveryDate(resolved?.date ?? todayYmd());

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
        <section className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
            Driver App
          </p>
          <h1 className="mt-2 text-3xl font-black">Invalid driver link</h1>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Sign in as the owner first, then open Driver App from the admin
            dashboard.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href="/admin/staff"
              className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white hover:bg-slate-800"
            >
              Staff Login
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800 hover:bg-slate-50"
            >
              Website Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const selectedTruck = normalizeTruck(resolved?.truck);
  const [deliveries, closeouts] = await Promise.all([
    loadAdminDeliveries(date),
    loadDriverCloseoutReports({ date, truck: selectedTruck }),
  ]);
  const grouped = groupByTruck(deliveries.bookings);
  const closeoutByStop = new Map(
    closeouts.map((report) => [closeoutKey(report.bookingId, report.truck), report]),
  );
  const visibleGroups = selectedTruck
    ? grouped.filter((group) => group.truck === selectedTruck)
    : [];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950">
      <DriverAutoRefresh />
      <section className="mx-auto max-w-4xl">
        <nav className="driver-screen-only mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <AdminBackButton />
          <Link
            href={`/admin?token=${encodeURIComponent(token)}`}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-3 py-2 text-center text-sm font-black leading-tight text-white hover:bg-slate-800"
          >
            Admin Home
          </Link>
          <Link
            href={`/admin/deliveries?token=${encodeURIComponent(token)}&date=${date}`}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black leading-tight text-slate-700 hover:bg-slate-50"
          >
            Route Planner
          </Link>
          <PrintButton label="Print All Sheets" />
        </nav>
        <DriverAssignmentPrintButtons
          assignments={buildDriverAssignments(visibleGroups)}
        />
        <header className="driver-screen-only rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-200">
            Jumping Jax Driver
          </p>
          <h1 className="mt-2 text-3xl font-black">Today&apos;s Deliveries</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            {formatDate(date)} - {deliveries.summary.bookingCount} stops
          </p>
        </header>

        {resolved?.message ? (
          <div className="driver-screen-only mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-950">
            {resolved.message}
          </div>
        ) : null}
        {resolved?.error ? (
          <div className="driver-screen-only mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-950">
            {resolved.error}
          </div>
        ) : null}

        <div className="driver-screen-only mt-4 grid grid-cols-3 gap-2">
          <Link
            href={`/driver?token=${encodeURIComponent(token)}&date=${addDays(date, -1)}${selectedTruck ? `&truck=${encodeURIComponent(selectedTruck)}` : ""}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-black"
          >
            Yesterday
          </Link>
          <Link
            href={`/driver?token=${encodeURIComponent(token)}&date=${todayYmd()}${selectedTruck ? `&truck=${encodeURIComponent(selectedTruck)}` : ""}`}
            className="rounded-xl bg-sky-500 px-3 py-3 text-center text-sm font-black text-white"
          >
            Today
          </Link>
          <Link
            href={`/driver?token=${encodeURIComponent(token)}&date=${addDays(date, 1)}${selectedTruck ? `&truck=${encodeURIComponent(selectedTruck)}` : ""}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-black"
          >
            Tomorrow
          </Link>
        </div>

        <form className="driver-screen-only mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <input type="hidden" name="token" value={token} />
          {selectedTruck ? (
            <input type="hidden" name="truck" value={selectedTruck} />
          ) : null}
          <label className="text-sm font-black text-slate-700">
            Pick date
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-base font-bold"
            />
          </label>
          <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
            Load Date
          </button>
        </form>

        <nav className="driver-screen-only mt-4 grid gap-2 sm:grid-cols-2">
          {TRUCKS.map((truck) => {
            const group = grouped.find((item) => item.truck === truck.id);
            return (
            <Link
              key={truck.id}
              href={`/driver?token=${encodeURIComponent(token)}&date=${date}&truck=${encodeURIComponent(truck.id)}`}
              className={`rounded-2xl px-4 py-4 text-center text-base font-black shadow-sm ${
                selectedTruck === truck.id
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-950"
              }`}
            >
              {truck.label} ({group?.bookings.length ?? 0})
            </Link>
          )})}
        </nav>

        <div className="driver-screen-only mt-4 grid gap-5">
          {!selectedTruck ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <h2 className="text-xl font-black">Choose a truck to sign in.</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Short Trailer and Long Trailer each show only their own route, payment confirmations,
                status buttons, and end-of-day issue checklist.
              </p>
            </section>
          ) : visibleGroups.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <h2 className="text-xl font-black">No deliveries found.</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Active rentals for {truckLabel(selectedTruck)} will show here after the route plan is saved.
              </p>
            </section>
          ) : (
            visibleGroups.map((group) => {
              const map = routeUrl(group.bookings);
              const overviewMap = routeEmbedUrl(group.bookings);
              return (
                <section key={group.truck} className="grid gap-3">
                  <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Route
                        </p>
                        <h2 className="text-2xl font-black">{truckLabel(group.truck)}</h2>
                      </div>
                      {map ? (
                        <a
                          href={map}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-amber-950"
                        >
                          Open Route
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {overviewMap ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                            Overview map
                          </p>
                          <p className="text-sm font-bold text-slate-700">
                            {group.bookings.length} stops for {truckLabel(group.truck)}
                          </p>
                        </div>
                        {map ? (
                          <a
                            href={map}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-amber-950"
                          >
                            Open Route
                          </a>
                        ) : null}
                      </div>
                      <iframe
                        title={`${truckLabel(group.truck)} overview map`}
                        src={overviewMap}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="h-72 w-full border-0"
                      />
                    </div>
                  ) : null}
                  {group.bookings.map((booking) => (
                    <StopCard
                      key={booking.id}
                      booking={booking}
                      token={token}
                      date={date}
                      truck={group.truck}
                      closeout={closeoutByStop.get(closeoutKey(booking.id, group.truck))}
                      truckBookings={group.bookings}
                    />
                  ))}
                </section>
              );
            })
          )}
        </div>
        <DriverPrintSheets groups={visibleGroups} date={date} />
      </section>
    </main>
  );
}
