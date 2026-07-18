import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { AdminBackButton } from "@/app/admin/AdminBackButton";
import {
  loadAdminDeliveries,
  normalizeDeliveryDate,
  todayYmd,
  type AdminDeliveryWorkTask,
} from "@/lib/admin/deliveries";
import {
  closeoutKey,
  loadDriverCloseoutReports,
  type DriverCloseoutReport,
} from "@/lib/admin/driver-closeout";
import {
  buildDriverPageTitle,
  buildDriverPrintAssignments,
  buildDriverPrintSheets,
  buildDriverRouteSummary,
  collectDriverReadinessWarnings,
  countTasksByTruck,
  DRIVER_TRUCKS,
  driverTasksForDate,
  filterDriverTasksByTruck,
  groupDriverTasksByTrailerLoad,
  normalizeDriverTruck,
  printStopWorkLabel,
  sortDriverTasks,
  truckLabel,
  unassignedDriverTasks,
  type DriverPrintSheet,
  type DriverTruckFilter,
} from "@/lib/admin/driver-app";
import {
  consolidateLoadEquipment,
  equipmentForItem,
  formatLoadEquipmentTotals,
} from "@/lib/admin/inventory-equipment";
import {
  emptyInventoryOperationalFields,
  extensionCordsFromBlowers,
  formatDimensions,
  formatEquipmentEntries,
} from "@/lib/admin/inventory-ops";
import {
  buildDriverTripSheetPages,
  tripSheetPageIds,
} from "@/lib/admin/driver-trip-sheets";
import { MAX_TRAILER_INFLATABLES } from "@/lib/admin/trailer-capacity";
import { DriverAutoRefresh } from "./DriverAutoRefresh";
import { DriverAssignmentPrintButtons } from "./DriverAssignmentPrintButtons";
import { DriverTripSheetPrintButton } from "./DriverTripSheetPrintButton";
import { DriverTripSheets } from "./DriverTripSheets";
import { PrintButton } from "@/app/admin/PrintButton";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    date?: string;
    truck?: string;
    view?: string;
    message?: string;
    error?: string;
  }>;
};

const SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

function routeUrl(tasks: AdminDeliveryWorkTask[]): string | null {
  const stops = sortDriverTasks(tasks)
    .map((task) => task.eventAddress?.trim())
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

function routeEmbedUrl(tasks: AdminDeliveryWorkTask[]): string | null {
  const stops = sortDriverTasks(tasks)
    .map((task) => task.eventAddress?.trim())
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

function nextStopDirectionsUrl({
  current,
  truckTasks,
}: {
  current: AdminDeliveryWorkTask;
  truckTasks: AdminDeliveryWorkTask[];
}): string | null {
  const ordered = sortDriverTasks(
    truckTasks.filter((task) => task.eventAddress?.trim()),
  );
  const currentIndex = ordered.findIndex((task) => task.id === current.id);
  const next = currentIndex >= 0 ? ordered[currentIndex + 1] : ordered[0];
  const destination = next?.eventAddress?.trim();
  const origin = current.eventAddress?.trim() || SHOP_ADDRESS;
  if (!destination) return directionsUrl(SHOP_ADDRESS);
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function nextStopTask({
  current,
  truckTasks,
}: {
  current: AdminDeliveryWorkTask;
  truckTasks: AdminDeliveryWorkTask[];
}): AdminDeliveryWorkTask | null {
  const ordered = sortDriverTasks(
    truckTasks.filter((task) => task.eventAddress?.trim()),
  );
  const currentIndex = ordered.findIndex((task) => task.id === current.id);
  return currentIndex >= 0 ? ordered[currentIndex + 1] ?? null : ordered[0] ?? null;
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

function workTypeBadgeClasses(workType: AdminDeliveryWorkTask["workType"]): string {
  return workType === "pickup"
    ? "border-violet-200 bg-violet-100 text-violet-950"
    : "border-amber-200 bg-amber-100 text-amber-950";
}

function customerTextMessage(task: AdminDeliveryWorkTask): string {
  const workLabel = printStopWorkLabel(task.workType);
  return [
    `Hi ${task.customerName}, this is Jumping Jax.`,
    `We are reaching out about your rental ${workLabel.toLowerCase()} today.`,
    task.eventAddress ? `Address: ${task.eventAddress}` : null,
    "Reply here or call 864-933-1420 if you need us.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function DriverPrintSheets({ sheets }: { sheets: DriverPrintSheet[] }) {
  if (sheets.length === 0) {
    return (
      <section className="driver-print-only">
        <h1>Jumping Jax Driver Sheet</h1>
        <p>No assigned stops for this selection.</p>
      </section>
    );
  }

  return (
    <section className="driver-print-only">
      {sheets.map((sheet, index) => (
        <article
          key={sheet.sheetId}
          id={sheet.sheetId}
          className={`driver-print-sheet${index > 0 ? " driver-print-sheet-break" : ""}`}
        >
          <header className="driver-print-sheet-head">
            <div>
              <h1>Jumping Jax Driver Sheet</h1>
              <p>
                {sheet.date} · {sheet.workTypeLabel}
              </p>
            </div>
            <div>
              <p>
                <strong>Truck:</strong> {sheet.truckLabel}
              </p>
              <p>
                <strong>Trailer load:</strong> Load {sheet.load}
              </p>
              <p>
                <strong>Stops:</strong> {sheet.stops.length}
              </p>
            </div>
          </header>
          <table className="driver-print-table">
            <thead>
              <tr>
                <th>Stop</th>
                <th>Work</th>
                <th>Times</th>
                <th>Customer / Address</th>
                <th>Product</th>
                <th>Setup / Notes</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {sheet.stops.map((stop) => (
                <tr key={stop.id}>
                  <td>
                    {stop.deliverySequence == null ? "—" : stop.deliverySequence}
                  </td>
                  <td>{printStopWorkLabel(stop.workType)}</td>
                  <td>
                    <p>
                      <strong>Arrive:</strong> {formatTime(stop.plannedArrivalTime)}
                    </p>
                    <p>
                      <strong>Party:</strong> {formatTime(stop.eventStartTime)}
                    </p>
                    <p>
                      <strong>Window:</strong>{" "}
                      {stop.requestedDeliveryWindow ?? "Not set"}
                    </p>
                  </td>
                  <td>
                    <p>
                      <strong>{stop.customerName}</strong>
                    </p>
                    <p>{stop.customerPhone ?? "No phone"}</p>
                    <p>{stop.eventAddress ?? "No address"}</p>
                  </td>
                  <td>
                    <p>{stop.rentalName}</p>
                  </td>
                  <td>
                    <p>
                      <strong>Location:</strong> {stop.setupLocation ?? "Not set"}
                    </p>
                    <p>
                      <strong>Surface:</strong> {stop.setupSurface ?? "Not set"}
                    </p>
                    <p>
                      <strong>Access:</strong> {stop.setupAccess ?? "Not set"}
                    </p>
                    <p>
                      <strong>Setup:</strong> {stop.setupNotes ?? "None"}
                    </p>
                    {stop.routeNotes ? (
                      <p>
                        <strong>Route notes:</strong> {stop.routeNotes}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <p>
                      <strong>Pay:</strong> {stop.paymentMethod ?? "Not set"}
                    </p>
                    <p>
                      <strong>Amount due:</strong> {formatMoney(stop.total)}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {statusLabel(stop.routeStatus ?? "planned")}
                    </p>
                    {stop.paymentConfirmationNotes ? (
                      <p>
                        <strong>Payment note:</strong>{" "}
                        {stop.paymentConfirmationNotes}
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

function DriverStatusButton({
  token,
  date,
  truck,
  view,
  task,
  status,
  label,
  tone,
}: {
  token: string;
  date: string;
  truck: string;
  view: string;
  task: AdminDeliveryWorkTask;
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
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="bookingId" value={task.bookingId} />
      <input type="hidden" name="itemId" value={task.itemId} />
      <input type="hidden" name="workType" value={task.workType} />
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
  view,
  task,
}: {
  token: string;
  date: string;
  truck: string;
  view: string;
  task: AdminDeliveryWorkTask;
}) {
  if (task.paymentConfirmedAt) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        Payment confirmed
        {task.paymentConfirmedBy ? ` by ${task.paymentConfirmedBy}` : ""}
      </div>
    );
  }

  return (
    <form action="/api/driver/payment" method="post" className="grid gap-2">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="truck" value={truck} />
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="bookingId" value={task.bookingId} />
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
  view,
  task,
  report,
  nextUrl,
  nextTask,
}: {
  token: string;
  date: string;
  truck: string;
  view: string;
  task: AdminDeliveryWorkTask;
  report?: DriverCloseoutReport;
  nextUrl: string | null;
  nextTask: AdminDeliveryWorkTask | null;
}) {
  const hasReport = Boolean(report);
  return (
    <form
      action="/api/driver/closeout"
      method="post"
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="truck" value={truck} />
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="bookingId" value={task.bookingId} />
      <input type="hidden" name="itemId" value={task.itemId} />
      <input type="hidden" name="workType" value={task.workType} />
      {nextUrl ? <input type="hidden" name="nextUrl" value={nextUrl} /> : null}
      {nextTask ? (
        <>
          <input type="hidden" name="nextBookingId" value={nextTask.bookingId} />
          <input type="hidden" name="nextItemId" value={nextTask.itemId} />
          <input type="hidden" name="nextWorkType" value={nextTask.workType} />
        </>
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
          defaultChecked={report?.paid === true || task.paymentConfirmedAt !== null}
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
        {nextTask ? (
          <CloseoutCheckbox
            name="notifyNextCustomer"
            label={`Email next customer: ${nextTask.customerName}`}
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
  task,
  token,
  date,
  truck,
  view,
  closeout,
  truckTasks,
}: {
  task: AdminDeliveryWorkTask;
  token: string;
  date: string;
  truck: string;
  view: string;
  closeout?: DriverCloseoutReport;
  truckTasks: AdminDeliveryWorkTask[];
}) {
  const status = task.routeStatus ?? "planned";
  const workLabel = printStopWorkLabel(task.workType);
  const call = phoneHref(task.customerPhone);
  const text = textHref(task.customerPhone, customerTextMessage(task));
  const map = directionsUrl(task.eventAddress);
  const nextMap = nextStopDirectionsUrl({ current: task, truckTasks });
  const nextTask = nextStopTask({ current: task, truckTasks });

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Stop {task.sequence == null ? "—" : task.sequence}
            </p>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${workTypeBadgeClasses(task.workType)}`}
            >
              {workLabel}
            </span>
            {task.trailerLoad != null ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-black text-slate-700">
                Load {task.trailerLoad}
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-xl font-black">{task.customerName}</h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {task.rentalName}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-600">
            Party starts {formatTime(task.eventStartTime)}
          </p>
          {task.crossDateLabel ? (
            <p className="mt-1 text-xs font-bold text-amber-800">{task.crossDateLabel}</p>
          ) : null}
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
          {formatTime(task.plannedArrivalTime)}
        </p>
        <p>
          <span className="font-black">Window:</span>{" "}
          {task.requestedDeliveryWindow ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Address:</span>{" "}
          {task.eventAddress ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Phone:</span>{" "}
          {task.customerPhone ?? "Not set"}
        </p>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <p>
          <span className="font-black">Location:</span>{" "}
          {task.setupLocation ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Surface:</span>{" "}
          {task.setupSurface ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Access:</span> {task.setupAccess ?? "Not set"}
        </p>
        <p>
          <span className="font-black">Notes:</span> {task.setupNotes ?? "None"}
        </p>
        {task.routeNotes ? (
          <p>
            <span className="font-black">Route notes:</span> {task.routeNotes}
          </p>
        ) : null}
      </div>

      {(() => {
        const ops =
          task.inventoryOps ??
          emptyInventoryOperationalFields(
            task.inventoryCategoryId ?? "bounce-houses",
          );
        const cords = extensionCordsFromBlowers(ops.blowers);
        return (
          <div className="mt-3 grid gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Equipment for this stop
            </p>
            <p>
              <span className="font-black">Dimensions:</span>{" "}
              {formatDimensions(ops.dimensions)}
            </p>
            <p>
              <span className="font-black">Blowers:</span>{" "}
              {formatEquipmentEntries(ops.blowers)}
            </p>
            <p>
              <span className="font-black">Extension cords:</span>{" "}
              {cords.cords100ft}× 100ft · {cords.cords50ft}× 50ft
            </p>
            <p>
              <span className="font-black">Tarps:</span>{" "}
              {formatEquipmentEntries(ops.tarps)}
            </p>
            <p>
              <span className="font-black">Supplies:</span>{" "}
              {[
                ops.requiresSlideSpray ? "Slide spray" : null,
                ops.requiresDisinfectant ? "Disinfectant" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "None"}
            </p>
          </div>
        );
      })()}

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
              {task.customerEmail ?? "Not set"}
            </p>
            <p>
              <span className="font-black">Event date:</span> {task.eventDate}
            </p>
            <p>
              <span className="font-black">Distance:</span>{" "}
              {task.distanceMiles !== null
                ? `${task.distanceMiles.toFixed(1)} miles`
                : "Not set"}
            </p>
            <p>
              <span className="font-black">Payment:</span>{" "}
              {task.paymentMethod ?? "Not set"}
            </p>
            <p>
              <span className="font-black">Payment confirmed:</span>{" "}
              {task.paymentConfirmedAt ? "Yes" : "No"}
            </p>
            <p>
              <span className="font-black">Total:</span>{" "}
              {task.total !== null ? `$${task.total.toFixed(2)}` : "Not set"}
            </p>
            <Link
              href={`/admin/rentals?token=${encodeURIComponent(token)}&from=${task.eventDate}&to=${task.eventDate}&status=all`}
              className="mt-2 rounded-xl bg-slate-950 px-4 py-3 text-center font-black text-white"
            >
              Open rental details
            </Link>
          </div>
        </details>
      </div>

      {truck === "unassigned" ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
          Assign this work in Route Planner before using driver execution actions.
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Booking payment
            </p>
            <p className="mb-2 text-xs font-semibold text-slate-600">
              Confirms payment for the whole booking, not just this item.
            </p>
            <PaymentConfirmForm
              token={token}
              date={date}
              truck={truck}
              view={view}
              task={task}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <DriverStatusButton
              token={token}
              date={date}
              truck={truck}
              view={view}
              task={task}
              status="on-the-way"
              label={
                task.workType === "pickup"
                  ? "Email: pickup on the way"
                  : "Email: on the way"
              }
              tone="blue"
            />
            {task.workType === "delivery" ? (
              <>
                <DriverStatusButton
                  token={token}
                  date={date}
                  truck={truck}
                  view={view}
                  task={task}
                  status="delivered"
                  label="Delivered"
                  tone="dark"
                />
                <DriverStatusButton
                  token={token}
                  date={date}
                  truck={truck}
                  view={view}
                  task={task}
                  status="setup-complete"
                  label="Setup complete"
                  tone="green"
                />
              </>
            ) : (
              <DriverStatusButton
                token={token}
                date={date}
                truck={truck}
                view={view}
                task={task}
                status="picked-up"
                label="Pickup complete"
                tone="dark"
              />
            )}
          </div>

          <CloseoutIssueForm
            token={token}
            date={date}
            truck={truck}
            view={view}
            task={task}
            report={closeout}
            nextUrl={nextMap}
            nextTask={nextTask}
          />
        </>
      )}
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
            Sign in as staff first, then open Driver App from the admin dashboard.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href="/admin"
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

  const selectedTruck = normalizeDriverTruck(resolved?.truck);
  const viewUnassigned =
    resolved?.view === "unassigned" || selectedTruck === "unassigned";
  const activeView: DriverTruckFilter | null = viewUnassigned
    ? "unassigned"
    : selectedTruck;

  const [deliveries, closeouts] = await Promise.all([
    loadAdminDeliveries(date),
    loadDriverCloseoutReports({
      date,
      truck:
        activeView && activeView !== "unassigned" ? activeView : undefined,
    }),
  ]);

  const dateTasks = driverTasksForDate(deliveries.tasks, date);
  const unassigned = unassignedDriverTasks({
    tasks: deliveries.tasks,
    unscheduled: deliveries.unscheduled,
    date,
  });
  const truckCounts = countTasksByTruck(dateTasks);
  truckCounts.unassigned = Math.max(truckCounts.unassigned, unassigned.length);

  const issueCount = closeouts.filter(
    (report) =>
      report.damageIssue ||
      report.missingItemIssue ||
      report.customerIssue ||
      report.siteAccessIssue ||
      report.latePickupIssue ||
      report.officeFollowupNeeded ||
      Boolean(report.notes?.trim()),
  ).length;

  const summary = buildDriverRouteSummary({
    dateTasks,
    unassigned,
    closeoutIssueCount: issueCount,
  });
  const readiness = collectDriverReadinessWarnings({
    dateTasks,
    unassigned,
    plannerWarnings: deliveries.warnings,
  });
  const hardWarnings = readiness.filter((item) => item.level === "hard");
  const softWarnings = readiness.filter((item) => item.level === "soft");

  const visibleTasks = activeView
    ? sortDriverTasks(
        activeView === "unassigned"
          ? unassigned
          : filterDriverTasksByTruck(dateTasks, activeView),
      )
    : [];
  const loadGroups =
    activeView && activeView !== "unassigned"
      ? groupDriverTasksByTrailerLoad(visibleTasks)
      : [{ load: 0, tasks: visibleTasks }];

  const closeoutByStop = new Map(
    closeouts.map((report) => [closeoutKey(report.bookingId, report.truck), report]),
  );

  const printSheets =
    activeView && activeView !== "unassigned"
      ? buildDriverPrintSheets({
          date,
          tasks: dateTasks,
          truckFilter: activeView,
        })
      : [];
  const tripSheetPages =
    activeView && activeView !== "unassigned"
      ? buildDriverTripSheetPages({ visibleTasks })
      : [];
  const tripSheetIds = tripSheetPageIds(tripSheetPages);

  const pageTitle = buildDriverPageTitle({ date });
  const routePlannerHref = `/admin/deliveries?token=${encodeURIComponent(token)}&date=${date}`;
  const scheduleHref = `/admin/schedule?token=${encodeURIComponent(token)}`;

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
            href={routePlannerHref}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black leading-tight text-slate-700 hover:bg-slate-50"
          >
            Route Planner
          </Link>
          <Link
            href={scheduleHref}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black leading-tight text-slate-700 hover:bg-slate-50"
          >
            Schedule
          </Link>
          {printSheets.length > 0 ? <PrintButton label="Print All Sheets" /> : null}
        </nav>

        <DriverAssignmentPrintButtons
          assignments={buildDriverPrintAssignments(printSheets)}
        />

        <header className="driver-screen-only rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-200">
            Jumping Jax Driver
          </p>
          <h1 className="mt-2 text-3xl font-black">{pageTitle}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            {summary.totalWork} work items · {summary.dropOffs} drop-offs ·{" "}
            {summary.pickups} pickups
          </p>
        </header>

        <div className="driver-screen-only mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Total", summary.totalWork],
            ["Unassigned", summary.unassigned],
            ["In progress", summary.inProgress],
            ["Completed", summary.completed],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>

        {summary.unassigned > 0 ? (
          <div className="driver-screen-only mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <p className="text-sm font-black text-amber-950">
              {summary.unassigned} unassigned work item
              {summary.unassigned === 1 ? "" : "s"} for this date
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-900">
              {
                unassigned.filter((task) => task.workType === "delivery").length
              }{" "}
              drop-off ·{" "}
              {unassigned.filter((task) => task.workType === "pickup").length}{" "}
              pickup. Planning stays in Route Planner.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/driver?token=${encodeURIComponent(token)}&date=${date}&view=unassigned`}
                className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-black text-amber-950"
              >
                View unassigned
              </Link>
              <Link
                href={routePlannerHref}
                className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-black text-amber-950"
              >
                Open Route Planner
              </Link>
            </div>
          </div>
        ) : null}

        {hardWarnings.length > 0 || softWarnings.length > 0 ? (
          <div className="driver-screen-only mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Readiness
            </p>
            {hardWarnings.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm font-bold text-rose-800">
                {hardWarnings.slice(0, 6).map((warning) => (
                  <li key={`${warning.code}-${warning.taskId}-${warning.message}`}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {softWarnings.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
                {softWarnings.slice(0, 4).map((warning) => (
                  <li key={`${warning.code}-${warning.taskId}-${warning.message}`}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {hardWarnings.length + softWarnings.length > 10 ? (
              <p className="mt-2 text-xs font-bold text-slate-500">
                Showing top warnings. Review Route Planner for the full plan.
              </p>
            ) : null}
          </div>
        ) : null}

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
            href={`/driver?token=${encodeURIComponent(token)}&date=${addDays(date, -1)}${activeView ? `&truck=${encodeURIComponent(activeView)}` : ""}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-black"
          >
            Yesterday
          </Link>
          <Link
            href={`/driver?token=${encodeURIComponent(token)}&date=${todayYmd()}${activeView ? `&truck=${encodeURIComponent(activeView)}` : ""}`}
            className="rounded-xl bg-sky-500 px-3 py-3 text-center text-sm font-black text-white"
          >
            Today
          </Link>
          <Link
            href={`/driver?token=${encodeURIComponent(token)}&date=${addDays(date, 1)}${activeView ? `&truck=${encodeURIComponent(activeView)}` : ""}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-black"
          >
            Tomorrow
          </Link>
        </div>

        <form className="driver-screen-only mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <input type="hidden" name="token" value={token} />
          {activeView ? (
            <input
              type="hidden"
              name={activeView === "unassigned" ? "view" : "truck"}
              value={activeView}
            />
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

        <nav className="driver-screen-only mt-4 grid gap-2 sm:grid-cols-3">
          {DRIVER_TRUCKS.map((truck) => (
            <Link
              key={truck.id}
              href={`/driver?token=${encodeURIComponent(token)}&date=${date}&truck=${encodeURIComponent(truck.id)}`}
              className={`rounded-2xl px-4 py-4 text-center text-base font-black shadow-sm ${
                activeView === truck.id
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-950"
              }`}
            >
              {truck.label} ({truckCounts[truck.id]})
            </Link>
          ))}
          {summary.unassigned > 0 ? (
            <Link
              href={`/driver?token=${encodeURIComponent(token)}&date=${date}&view=unassigned`}
              className={`rounded-2xl px-4 py-4 text-center text-base font-black shadow-sm sm:col-span-3 ${
                activeView === "unassigned"
                  ? "bg-amber-500 text-amber-950"
                  : "border border-amber-300 bg-amber-50 text-amber-950"
              }`}
            >
              Unassigned ({summary.unassigned})
            </Link>
          ) : null}
        </nav>

        <div className="driver-screen-only mt-4 grid gap-5">
          {!activeView ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <h2 className="text-xl font-black">Choose a truck to sign in.</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Short Trailer and Long Trailer each show only their own drop-offs,
                pickups, payment confirmations, status buttons, and checklists.
              </p>
            </section>
          ) : visibleTasks.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <h2 className="text-xl font-black">
                {activeView === "unassigned"
                  ? "No unassigned work."
                  : "No route work found."}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {activeView === "unassigned"
                  ? "All work for this date has a truck assignment."
                  : `Drop-offs and pickups for ${truckLabel(activeView)} appear here after the route plan is saved.`}
              </p>
              <Link
                href={routePlannerHref}
                className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
              >
                Open Route Planner
              </Link>
            </section>
          ) : (
            <section className="grid gap-3">
              <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Route
                    </p>
                    <h2 className="text-2xl font-black">
                      {activeView === "unassigned"
                        ? "Unassigned"
                        : truckLabel(activeView)}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {visibleTasks.length} stop
                      {visibleTasks.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {activeView !== "unassigned" && routeUrl(visibleTasks) ? (
                    <a
                      href={routeUrl(visibleTasks)!}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-amber-950"
                    >
                      Open Route
                    </a>
                  ) : null}
                </div>
              </div>

              {activeView !== "unassigned" && routeEmbedUrl(visibleTasks) ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Overview map
                    </p>
                  </div>
                  <iframe
                    title={`${truckLabel(activeView)} overview map`}
                    src={routeEmbedUrl(visibleTasks)!}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-72 w-full border-0"
                  />
                </div>
              ) : null}

              {tripSheetPages.length > 0 ? (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <DriverTripSheetPrintButton
                    allPageIds={tripSheetIds}
                    label="Print all trip sheets"
                  />
                  {tripSheetPages.map((page) => (
                    <DriverTripSheetPrintButton
                      key={page.pageId}
                      allPageIds={tripSheetIds}
                      targetPageId={page.pageId}
                      label={`Print ${page.truckAndLoadLabel}`}
                    />
                  ))}
                </div>
              ) : null}

              {loadGroups.map((group) => {
                const inflatableTasks = group.tasks.filter(
                  (task) => task.isInflatable !== false,
                );
                const loadTotals = consolidateLoadEquipment(
                  inflatableTasks.map((task) =>
                    equipmentForItem({
                      taskId: task.id,
                      rentalItem: task.rentalItem,
                      rentalName: task.rentalName,
                      isInflatable: task.isInflatable !== false,
                      ops:
                        task.inventoryOps ??
                        emptyInventoryOperationalFields(
                          task.inventoryCategoryId ?? "bounce-houses",
                        ),
                    }),
                  ),
                );
                const overCapacity =
                  loadTotals.inflatableCount > MAX_TRAILER_INFLATABLES;
                return (
                <div key={`load-${group.load}`} className="grid gap-3">
                  {activeView !== "unassigned" && group.load > 0 ? (
                    <div
                      className={`rounded-2xl border p-3 ${
                        overCapacity
                          ? "border-rose-300 bg-rose-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Trailer load {group.load} · {loadTotals.inflatableCount}/
                        {MAX_TRAILER_INFLATABLES} inflatables
                      </p>
                      {overCapacity ? (
                        <p className="mt-1 text-sm font-bold text-rose-800">
                          Over capacity — max {MAX_TRAILER_INFLATABLES}{" "}
                          inflatables per trailer.
                        </p>
                      ) : null}
                      <ul className="mt-2 grid gap-1 text-sm font-semibold text-slate-700">
                        {formatLoadEquipmentTotals(loadTotals).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {group.tasks.map((task) => (
                    <StopCard
                      key={task.id}
                      task={task}
                      token={token}
                      date={date}
                      truck={
                        activeView === "unassigned"
                          ? "unassigned"
                          : (task.truck ?? activeView)
                      }
                      view={activeView === "unassigned" ? "unassigned" : ""}
                      closeout={
                        task.truck
                          ? closeoutByStop.get(closeoutKey(task.bookingId, task.truck))
                          : undefined
                      }
                      truckTasks={visibleTasks}
                    />
                  ))}
                </div>
              );
              })}
            </section>
          )}
        </div>

        <DriverPrintSheets sheets={printSheets} />
        <DriverTripSheets pages={tripSheetPages} />
      </section>
    </main>
  );
}
