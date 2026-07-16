"use client";

import { useMemo, useState } from "react";
import type {
  AdminDeliveriesResult,
  AdminDeliveryBooking,
  AdminDeliveryItem,
} from "@/lib/admin/deliveries";

type TruckId = "truck-1" | "truck-2";
type ColumnId = "unassigned" | TruckId;

type PlannedInflatable = {
  id: string;
  itemId: string;
  bookingId: string;
  customerName: string;
  customerPhone: string | null;
  eventStartTime: string | null;
  requestedDeliveryWindow: string | null;
  eventAddress: string | null;
  distanceMiles: number | null;
  setupLocation: string | null;
  setupSurface: string | null;
  setupAccess: string | null;
  setupNotes: string | null;
  singleStopMapUrl: string | null;
  rentalName: string;
  rentalItem: string;
  isBigSlide: boolean;
  deliveryDate: string | null;
  deliveryTruck: TruckId | null;
  trailerLoad: number | null;
  deliverySequence: number | null;
  plannedArrivalTime: string | null;
  plannedSetupStart: string | null;
  plannedSetupEnd: string | null;
  deliveryRouteStatus: string | null;
  deliveryRouteNotes: string | null;
  estimatedSetupMinutes: number;
  warning: "ok" | "tight" | "late" | "missing_time" | "capacity" | "unplanned";
  warningText: string;
};

const SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";
const TRUCKS: TruckId[] = ["truck-1", "truck-2"];
const COLUMN_LABELS: Record<ColumnId, string> = {
  unassigned: "Needs Assignment",
  "truck-1": "Short Trailer",
  "truck-2": "Long Trailer",
};
const DAY_START_MINUTES = 7 * 60;
const FIRST_DRIVE_MINUTES = 45;
const BETWEEN_STOPS_MINUTES = 30;
const RETURN_TO_SHOP_MINUTES = 30;
const RELOAD_MINUTES = 20;
const TARGET_READY_BUFFER_MINUTES = 60;
const MIN_READY_BUFFER_MINUTES = 30;
const DELIVERY_WINDOW_MINUTES = 180;
const TRUCK_INFLATABLE_CAPACITY = 3;
const TRUCK_BIG_SLIDE_CAPACITY = 3;

function minutesFromTime(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeFromMinutes(value: number): string {
  const normalized = Math.max(0, value);
  const hour = Math.floor(normalized / 60) % 24;
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value: string | null): string {
  if (!value) return "Not set";
  const minutes = minutesFromTime(value);
  if (minutes == null) return value;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function routeUrl(items: PlannedInflatable[]): string | null {
  const stops = uniqueStops(items);
  if (stops.length === 0) return null;

  const routeStops = [SHOP_ADDRESS, ...stops, SHOP_ADDRESS];
  return `https://www.google.com/maps/dir/${routeStops
    .map((stop) => encodeURIComponent(stop))
    .join("/")}`;
}

function deliveryDeadlineMinutes(eventStartTime: string | null): number | null {
  const partyStart = minutesFromTime(eventStartTime);
  return partyStart == null ? null : partyStart - MIN_READY_BUFFER_MINUTES;
}

function deliveryWindowStartMinutes(eventStartTime: string | null): number | null {
  const deadline = deliveryDeadlineMinutes(eventStartTime);
  return deadline == null ? null : deadline - DELIVERY_WINDOW_MINUTES;
}

function uniqueStops(items: PlannedInflatable[]): string[] {
  const seen = new Set<string>();
  return items
    .map((item) => item.eventAddress?.trim())
    .filter((address): address is string => {
      if (!address || seen.has(address)) return false;
      seen.add(address);
      return true;
    });
}

function evaluateWarning(
  item: PlannedInflatable,
): Pick<PlannedInflatable, "warning" | "warningText"> {
  const partyStart = minutesFromTime(item.eventStartTime);
  const deliveryDeadline = deliveryDeadlineMinutes(item.eventStartTime);
  const setupEnd = minutesFromTime(item.plannedSetupEnd);

  if (partyStart == null) {
    return {
      warning: "missing_time",
      warningText: "Needs attention: no party start time is saved.",
    };
  }
  if (setupEnd == null) {
    return {
      warning: "unplanned",
      warningText: "Needs attention: assign this inflatable to a truck.",
    };
  }

  const buffer = partyStart - setupEnd;
  if (buffer < 0) {
    return {
      warning: "late",
      warningText: `Needs attention: setup ends ${Math.abs(buffer)} min after party starts.`,
    };
  }
  if (buffer < MIN_READY_BUFFER_MINUTES) {
    return {
      warning: "late",
      warningText: `Needs attention: setup ends after the ${formatTime(
        deliveryDeadline == null ? null : timeFromMinutes(deliveryDeadline),
      )} delivery deadline.`,
    };
  }
  if (buffer < TARGET_READY_BUFFER_MINUTES) {
    return {
      warning: "tight",
      warningText: `Close timing: ready ${buffer} min before party starts.`,
    };
  }
  return {
    warning: "ok",
    warningText: `Ready: finished ${buffer} min before party starts.`,
  };
}

function sortByPartyStart(a: PlannedInflatable, b: PlannedInflatable) {
  const aDeadline = deliveryDeadlineMinutes(a.eventStartTime) ?? 9999;
  const bDeadline = deliveryDeadlineMinutes(b.eventStartTime) ?? 9999;
  if (aDeadline !== bDeadline) return aDeadline - bDeadline;
  return a.customerName.localeCompare(b.customerName);
}

function sortForRoute(a: PlannedInflatable, b: PlannedInflatable) {
  const aDeadline = deliveryDeadlineMinutes(a.eventStartTime) ?? 9999;
  const bDeadline = deliveryDeadlineMinutes(b.eventStartTime) ?? 9999;
  if (aDeadline !== bDeadline) return aDeadline - bDeadline;

  const aMiles = a.distanceMiles ?? -1;
  const bMiles = b.distanceMiles ?? -1;
  if (aMiles !== bMiles) return bMiles - aMiles;

  return (a.eventAddress ?? "").localeCompare(b.eventAddress ?? "") ||
    a.customerName.localeCompare(b.customerName);
}

function sortTruckItems(items: PlannedInflatable[]) {
  return [...items].sort((a, b) => {
    const aSeq = a.deliverySequence ?? 999;
    const bSeq = b.deliverySequence ?? 999;
    if (aSeq !== bSeq) return aSeq - bSeq;
    return sortByPartyStart(a, b);
  });
}

function preferredTruckForAddress(address: string | null): TruckId {
  const text = address?.toLowerCase() ?? "";
  const westRouteTowns = [
    "abbeville",
    "bradley",
    "donalds",
    "due west",
    "calhoun falls",
  ];
  return westRouteTowns.some((town) => text.includes(town)) ? "truck-2" : "truck-1";
}

function flattenBookings(bookings: AdminDeliveryBooking[]): PlannedInflatable[] {
  return bookings.flatMap((booking) =>
    booking.items.map((item: AdminDeliveryItem) => ({
      id: item.id,
      itemId: item.id,
      bookingId: booking.id,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      eventStartTime: booking.eventStartTime,
      requestedDeliveryWindow: booking.requestedDeliveryWindow,
      eventAddress: booking.eventAddress,
      distanceMiles: booking.distanceMiles,
      setupLocation: booking.setupLocation,
      setupSurface: booking.setupSurface,
      setupAccess: booking.setupAccess,
      setupNotes: booking.setupNotes,
      singleStopMapUrl: booking.singleStopMapUrl,
      rentalName: item.rental_name,
      rentalItem: item.rental_item,
      isBigSlide: item.isBigSlide,
      deliveryDate: item.deliveryDate,
      deliveryTruck:
        item.deliveryTruck === "truck-1" || item.deliveryTruck === "truck-2"
          ? item.deliveryTruck
          : null,
      trailerLoad: item.trailerLoad,
      deliverySequence: item.deliverySequence,
      plannedArrivalTime: item.plannedArrivalTime,
      plannedSetupStart: item.plannedSetupStart,
      plannedSetupEnd: item.plannedSetupEnd,
      deliveryRouteStatus: item.deliveryRouteStatus,
      deliveryRouteNotes: item.deliveryRouteNotes,
      estimatedSetupMinutes: item.estimatedSetupMinutes,
      warning: "unplanned",
      warningText: "Needs attention: assign this inflatable to a truck.",
    })),
  );
}

function recalculatePlan(items: PlannedInflatable[]): PlannedInflatable[] {
  const byId = new Map<string, PlannedInflatable>();

  for (const item of items) {
    if (!item.deliveryTruck) {
      const unplanned = {
        ...item,
        deliverySequence: null,
        plannedArrivalTime: null,
        plannedSetupStart: null,
        plannedSetupEnd: null,
        deliveryRouteStatus: "unplanned",
      };
      byId.set(item.id, { ...unplanned, ...evaluateWarning(unplanned) });
    }
  }

  for (const truck of TRUCKS) {
    let availableAt = DAY_START_MINUTES;
    let sequence = 1;
    const truckItems = sortTruckItems(items.filter((item) => item.deliveryTruck === truck));
    const loadNumbers = [
      ...new Set(
        truckItems.map(
          (item, index) =>
            item.trailerLoad ?? Math.floor(index / TRUCK_INFLATABLE_CAPACITY) + 1,
        ),
      ),
    ].sort((a, b) => a - b);

    for (const loadNumber of loadNumbers) {
      let loadInflatableCount = 0;
      let loadBigSlideCount = 0;
      let lastBookingId: string | null = null;
      let loadAvailableAt = availableAt + FIRST_DRIVE_MINUTES;
      const loadItems = truckItems.filter(
        (item, index) =>
          (item.trailerLoad ?? Math.floor(index / TRUCK_INFLATABLE_CAPACITY) + 1) ===
          loadNumber,
      );

      loadItems.forEach((item) => {
        const sameStop = lastBookingId === item.bookingId;
        const windowStart = deliveryWindowStartMinutes(item.eventStartTime);
        const targetArrival =
          windowStart == null ? loadAvailableAt : Math.max(loadAvailableAt, windowStart);
        const setupStart = sameStop
          ? targetArrival - BETWEEN_STOPS_MINUTES
          : targetArrival;
        const setupEnd = setupStart + item.estimatedSetupMinutes;
        loadInflatableCount += 1;
        loadBigSlideCount += item.isBigSlide ? 1 : 0;

        const planned = {
          ...item,
          trailerLoad: loadNumber,
          deliverySequence: sequence,
          plannedArrivalTime: timeFromMinutes(setupStart),
          plannedSetupStart: timeFromMinutes(setupStart),
          plannedSetupEnd: timeFromMinutes(setupEnd),
          deliveryRouteStatus:
            item.deliveryRouteStatus === "planned" ? "planned" : "draft",
        };
        const capacityWarning =
          loadInflatableCount > TRUCK_INFLATABLE_CAPACITY ||
          loadBigSlideCount > TRUCK_BIG_SLIDE_CAPACITY;

        byId.set(
          item.id,
          capacityWarning
            ? {
                ...planned,
                warning: "capacity",
                warningText:
                  "Needs attention: this trailer load has more than 3 inflatables.",
              }
            : { ...planned, ...evaluateWarning(planned) },
        );

        loadAvailableAt = setupEnd + (sameStop ? 0 : BETWEEN_STOPS_MINUTES);
        lastBookingId = item.bookingId;
        sequence += 1;
      });

      availableAt = loadAvailableAt + RETURN_TO_SHOP_MINUTES + RELOAD_MINUTES;
    }
  }

  return items.map((item) => byId.get(item.id) ?? item);
}

function initialPlan(bookings: AdminDeliveryBooking[]): PlannedInflatable[] {
  const flattened = flattenBookings(bookings);
  const hasUnassigned = flattened.some((item) => !item.deliveryTruck);
  return hasUnassigned ? autoDraft(flattened) : recalculatePlan(flattened);
}

function autoDraft(items: PlannedInflatable[]): PlannedInflatable[] {
  const truckState: Record<
    TruckId,
    { availableAt: number; sequence: number; inflatableCount: number; bigSlideCount: number }
  > = {
    "truck-1": { availableAt: DAY_START_MINUTES + FIRST_DRIVE_MINUTES, sequence: 1, inflatableCount: 0, bigSlideCount: 0 },
    "truck-2": { availableAt: DAY_START_MINUTES + FIRST_DRIVE_MINUTES, sequence: 1, inflatableCount: 0, bigSlideCount: 0 },
  };

  return [...items].sort(sortForRoute).map((item) => {
    const preferredTruck = preferredTruckForAddress(item.eventAddress);
    const otherTruck = preferredTruck === "truck-1" ? "truck-2" : "truck-1";
    const preferredState = truckState[preferredTruck];
    const otherState = truckState[otherTruck];
    const preferredWouldFit =
      preferredState.inflatableCount + 1 <= TRUCK_INFLATABLE_CAPACITY &&
      preferredState.bigSlideCount + (item.isBigSlide ? 1 : 0) <=
        TRUCK_BIG_SLIDE_CAPACITY;
    const otherWouldFit =
      otherState.inflatableCount + 1 <= TRUCK_INFLATABLE_CAPACITY &&
      otherState.bigSlideCount + (item.isBigSlide ? 1 : 0) <=
        TRUCK_BIG_SLIDE_CAPACITY;

    let truck = preferredTruck;
    if (!preferredWouldFit && otherWouldFit) {
      truck = otherTruck;
    } else if (preferredState.availableAt - otherState.availableAt > 90 && otherWouldFit) {
      truck = otherTruck;
    } else if (!preferredWouldFit && !otherWouldFit && otherState.availableAt < preferredState.availableAt) {
      truck = otherTruck;
    }

    const state = truckState[truck];
    const windowStart = deliveryWindowStartMinutes(item.eventStartTime);
    const setupStart =
      windowStart == null ? state.availableAt : Math.max(state.availableAt, windowStart);
    const setupEnd = setupStart + item.estimatedSetupMinutes;
    const planned = {
      ...item,
      deliveryTruck: truck,
      deliverySequence: state.sequence,
      plannedArrivalTime: timeFromMinutes(setupStart),
      plannedSetupStart: timeFromMinutes(setupStart),
      plannedSetupEnd: timeFromMinutes(setupEnd),
      deliveryRouteStatus: "draft",
    };

    state.sequence += 1;
    state.availableAt = setupEnd + BETWEEN_STOPS_MINUTES;
    state.inflatableCount += 1;
    state.bigSlideCount += item.isBigSlide ? 1 : 0;

    return { ...planned, ...evaluateWarning(planned) };
  });
}

function columnItems(items: PlannedInflatable[], column: ColumnId) {
  return sortTruckItems(
    items.filter((item) =>
      column === "unassigned" ? !item.deliveryTruck : item.deliveryTruck === column,
    ),
  );
}

function moveWithinTruck(
  items: PlannedInflatable[],
  id: string,
  direction: -1 | 1,
): PlannedInflatable[] {
  const moving = items.find((item) => item.id === id);
  if (!moving?.deliveryTruck) return items;
  const truckItems = sortTruckItems(
    items.filter((item) => item.deliveryTruck === moving.deliveryTruck),
  );
  const index = truckItems.findIndex((item) => item.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= truckItems.length) return items;
  const reordered = [...truckItems];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex]!, reordered[index]!];
  const sequenceById = new Map(
    reordered.map((item, nextIndex) => [item.id, nextIndex + 1]),
  );
  return recalculatePlan(
    items.map((item) =>
      item.deliveryTruck === moving.deliveryTruck
        ? { ...item, deliverySequence: sequenceById.get(item.id) ?? null }
        : item,
    ),
  );
}

function routeAssignments(items: PlannedInflatable[]) {
  return items.map((item) => ({
    id: item.bookingId,
    bookingId: item.bookingId,
    itemId: item.itemId,
      deliveryTruck: item.deliveryTruck,
      deliveryDate: item.deliveryDate,
      trailerLoad: item.trailerLoad,
      deliverySequence: item.deliverySequence,
    plannedArrivalTime: item.plannedArrivalTime,
    plannedSetupStart: item.plannedSetupStart,
    plannedSetupEnd: item.plannedSetupEnd,
    estimatedSetupMinutes: item.estimatedSetupMinutes,
    deliveryRouteStatus: item.deliveryRouteStatus ?? "planned",
    deliveryRouteNotes: item.deliveryRouteNotes,
  }));
}

function warningClasses(warning: PlannedInflatable["warning"]) {
  if (warning === "ok") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (warning === "tight") return "border-amber-300 bg-amber-50 text-amber-950";
  if (warning === "unplanned") return "border-slate-200 bg-slate-50 text-slate-800";
  return "border-rose-300 bg-rose-50 text-rose-950";
}

function warningLabel(warning: PlannedInflatable["warning"]) {
  if (warning === "ok") return "READY";
  if (warning === "tight") return "CLOSE TIMING";
  return "NEEDS ATTENTION";
}

function printWarningLabel(warning: PlannedInflatable["warning"]) {
  if (warning === "ok") return "Ready";
  if (warning === "tight") return "Tight";
  if (warning === "missing_time") return "No start";
  if (warning === "capacity") return "Capacity";
  if (warning === "late") return "Late";
  return "Check";
}

function statusCounts(items: PlannedInflatable[]) {
  return items.reduce(
    (counts, item) => {
      if (!item.deliveryTruck) counts.unassigned += 1;
      if (
        item.warning === "late" ||
        item.warning === "capacity" ||
        item.warning === "missing_time" ||
        item.warning === "unplanned"
      ) {
        counts.needsAttention += 1;
      }
      if (item.warning === "tight") counts.closeTiming += 1;
      if (item.warning === "ok") counts.ready += 1;
      return counts;
    },
    { unassigned: 0, needsAttention: 0, closeTiming: 0, ready: 0 },
  );
}

function chunkLoads(items: PlannedInflatable[]): PlannedInflatable[][] {
  const sorted = sortTruckItems(items);
  const loadMap = new Map<number, PlannedInflatable[]>();
  sorted.forEach((item, index) => {
    const load = item.trailerLoad ?? Math.floor(index / TRUCK_INFLATABLE_CAPACITY) + 1;
    loadMap.set(load, [...(loadMap.get(load) ?? []), item]);
  });
  return [...loadMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, load]) => load);
}

function routeRangeLabel(load: PlannedInflatable[]): string {
  const sequences = load
    .map((item) => item.deliverySequence)
    .filter((value): value is number => typeof value === "number");
  if (sequences.length === 0) return "Stops not numbered yet";
  return sequences.length === 1
    ? `Stop ${sequences[0]}`
    : `Stops ${Math.min(...sequences)}-${Math.max(...sequences)}`;
}

function loadNumber(load: PlannedInflatable[], fallback: number): number {
  return load.find((item) => item.trailerLoad)?.trailerLoad ?? fallback;
}

function LoadSheet({
  truck,
  items,
}: {
  truck: TruckId;
  items: PlannedInflatable[];
}) {
  const loads = chunkLoads(items);
  const truckLabel = COLUMN_LABELS[truck];

  return (
    <section className="delivery-print-sheet rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm print:break-inside-auto print:border-slate-900 print:p-0 print:shadow-none">
      <div className="delivery-print-trailer-head flex flex-wrap items-start justify-between gap-3 border-b-2 border-slate-200 pb-3 print:border-slate-900">
        <div>
          <h3 className="text-2xl font-black text-slate-950">{truckLabel}</h3>
          <p className="mt-1 text-sm font-bold text-slate-700">
            Load the trailer in this order. Each load holds up to 3 inflatables.
          </p>
        </div>
        <p className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white">
          {items.length} inflatables
        </p>
      </div>

      {loads.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-base font-bold text-slate-700">
          No inflatables assigned to this truck.
        </p>
      ) : (
        <div className="delivery-print-loads mt-4 grid gap-4">
          {loads.map((load, index) => (
            <div
              key={`${truck}-load-${index}`}
              className="delivery-print-load rounded-xl border border-slate-300 bg-slate-50 p-4 print:border-slate-700"
            >
              <div className="delivery-print-load-head flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xl font-black text-slate-950">
                  {truckLabel} - Load {loadNumber(load, index + 1)}
                </h4>
                <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-black text-amber-950">
                  {routeRangeLabel(load)}
                </span>
              </div>
              <p className="delivery-print-shop-note mt-2 rounded-lg bg-rose-100 px-3 py-2 text-sm font-black text-rose-900">
                Shop to stops to shop. Reload before next load.
              </p>
              {routeUrl(load) ? (
                <a
                  href={routeUrl(load) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="delivery-print-map-link mt-2 inline-flex rounded-lg bg-amber-200 px-3 py-2 text-sm font-black text-amber-950"
                >
                  Open Load {loadNumber(load, index + 1)} Map
                </a>
              ) : null}
              <div className="delivery-print-table-wrap mt-3 overflow-x-auto rounded-xl border border-slate-300 bg-white">
                <table className="delivery-print-table w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th>Stop</th>
                      <th>Item</th>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Arrive</th>
                      <th>Party</th>
                      <th>Address</th>
                      <th>Setup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {load.map((item) => (
                      <tr key={item.id}>
                        <td>{item.deliverySequence ?? "?"}</td>
                        <td>
                          {item.rentalName}
                          {item.isBigSlide ? " (big)" : ""}
                        </td>
                        <td>{item.customerName}</td>
                        <td>{item.customerPhone ?? ""}</td>
                        <td>{formatTime(item.plannedArrivalTime)}</td>
                        <td>{formatTime(item.eventStartTime)}</td>
                        <td>
                          {item.eventAddress ?? "No address"}
                          {item.setupLocation ? ` | ${item.setupLocation}` : ""}
                        </td>
                        <td>
                          {printWarningLabel(item.warning)}
                          {item.setupSurface ? ` | ${item.setupSurface}` : ""}
                          {item.setupAccess ? ` | ${item.setupAccess}` : ""}
                          {item.setupNotes ? ` | ${item.setupNotes}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LoadMapLinks({
  truck,
  items,
}: {
  truck: TruckId;
  items: PlannedInflatable[];
}) {
  const loads = chunkLoads(items);
  if (loads.length === 0) return null;

  return (
    <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
      <p className="text-sm font-black text-slate-950">
        {COLUMN_LABELS[truck]} load maps
      </p>
      <p className="mt-1 text-xs font-bold text-slate-600">
        Each map starts at the shop, runs one trailer load, and returns to the
        shop.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {loads.map((load, index) => {
          const url = routeUrl(load);
          if (!url) return null;
          const number = loadNumber(load, index + 1);
          return (
            <a
              key={`${truck}-load-map-${number}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-amber-200 px-3 py-2 text-sm font-black text-amber-950 hover:bg-amber-300"
            >
              Load {number} Map
            </a>
          );
        })}
      </div>
    </div>
  );
}

function InflatableCard({
  item,
  plannerDate,
  onDateChange,
  onLoadChange,
  onAssign,
  onUnassign,
  onMove,
}: {
  item: PlannedInflatable;
  plannerDate: string;
  onDateChange: (id: string, date: string) => void;
  onLoadChange: (id: string, load: number) => void;
  onAssign: (id: string, truck: TruckId) => void;
  onUnassign: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  return (
    <article className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">
            Booking #{item.bookingId}
          </p>
          <h3 className="mt-1 text-lg font-black leading-tight text-slate-950">
            {item.rentalName}
          </h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {item.customerName}
          </p>
        </div>
        {item.deliverySequence && (
          <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-black text-white">
            Stop {item.deliverySequence}
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-2 rounded-xl bg-sky-50 p-3 text-sm">
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Party starts</span>
          <span className="text-right font-black text-slate-950">
            {formatTime(item.eventStartTime)}
          </span>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Crew arrives</span>
          <span className="text-right font-black text-slate-950">
            {formatTime(item.plannedArrivalTime)}
          </span>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Setup finished</span>
          <span className="text-right font-black text-slate-950">
            {formatTime(item.plannedSetupEnd)}
          </span>
        </p>
      </div>

      <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-black ${warningClasses(item.warning)}`}>
        <span className="mr-2">{warningLabel(item.warning)}:</span>
        {item.warningText}
      </p>

      <p className="mt-3 text-sm text-slate-700">
        Window: {item.requestedDeliveryWindow ?? "No delivery window saved"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {item.eventAddress ?? "No address"}
      </p>
      {item.isBigSlide && (
        <p className="mt-2 inline-flex rounded-full bg-sky-200 px-3 py-1 text-xs font-black uppercase text-sky-900">
          Big slide
        </p>
      )}

      <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-black sm:grid-cols-3">
        <label className="grid gap-1 text-slate-700">
          Take it
          <input
            type="date"
            value={item.deliveryDate ?? plannerDate}
            onChange={(event) => onDateChange(item.id, event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-950"
          />
        </label>
        <label className="grid gap-1 text-slate-700">
          Trailer
          <select
            value={item.deliveryTruck ?? ""}
            onChange={(event) =>
              event.target.value
                ? onAssign(item.id, event.target.value as TruckId)
                : onUnassign(item.id)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-950"
          >
            <option value="">Unassigned</option>
            <option value="truck-1">Short Trailer</option>
            <option value="truck-2">Long Trailer</option>
          </select>
        </label>
        <label className="grid gap-1 text-slate-700">
          Load
          <select
            value={item.trailerLoad ?? 1}
            onChange={(event) => onLoadChange(item.id, Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-950"
          >
            <option value={1}>Load 1</option>
            <option value={2}>Load 2</option>
            <option value={3}>Load 3</option>
            <option value={4}>Load 4</option>
          </select>
        </label>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-black">
        {[
          { label: "Prev day", date: addDays(plannerDate, -1) },
          { label: "This day", date: plannerDate },
          { label: "Next day", date: addDays(plannerDate, 1) },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onDateChange(item.id, option.date)}
            className={`rounded-lg px-2 py-2 ${
              (item.deliveryDate ?? plannerDate) === option.date
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-sm font-black sm:grid-cols-4">
        <button type="button" onClick={() => onMove(item.id, -1)} disabled={!item.deliveryTruck} className="rounded-xl bg-white px-3 py-3 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">
          Up
        </button>
        <button type="button" onClick={() => onMove(item.id, 1)} disabled={!item.deliveryTruck} className="rounded-xl bg-white px-3 py-3 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">
          Down
        </button>
        <button type="button" onClick={() => onUnassign(item.id)} disabled={!item.deliveryTruck} className="rounded-xl bg-slate-100 px-3 py-3 text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45">
          Clear
        </button>
        {item.singleStopMapUrl && (
          <a href={item.singleStopMapUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-amber-200 px-3 py-3 text-center text-amber-950 hover:bg-amber-300">
            Map
          </a>
        )}
      </div>
    </article>
  );
}

function DeliveryColumn({
  column,
  items,
  plannerDate,
  onDateChange,
  onLoadChange,
  onAssign,
  onUnassign,
  onMove,
}: {
  column: ColumnId;
  items: PlannedInflatable[];
  plannerDate: string;
  onDateChange: (id: string, date: string) => void;
  onLoadChange: (id: string, load: number) => void;
  onAssign: (id: string, truck: TruckId) => void;
  onUnassign: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const bigSlideCount = items.filter((item) => item.isBigSlide).length;
  const overloaded =
    items.length > TRUCK_INFLATABLE_CAPACITY ||
    bigSlideCount > TRUCK_BIG_SLIDE_CAPACITY;

  return (
    <section className={`rounded-xl border p-3 ${overloaded ? "border-rose-300 bg-rose-50" : "border-sky-100 bg-sky-50"}`}>
      <div className="mb-3 flex items-start justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl font-black text-slate-950">
            {COLUMN_LABELS[column]}
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {items.length}/3 inflatables | {bigSlideCount}/3 big slides
          </p>
          {overloaded && (
            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-rose-800">
              Too much for the first load.
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sky-200 bg-white p-5 text-sm font-bold text-slate-600">
            {column === "unassigned"
              ? "Every inflatable has a truck."
              : "Click Auto-Plan, or put an inflatable here manually."}
          </div>
        ) : (
          items.map((item) => (
            <InflatableCard
              key={item.id}
              item={item}
              plannerDate={plannerDate}
              onDateChange={onDateChange}
              onLoadChange={onLoadChange}
              onAssign={onAssign}
              onUnassign={onUnassign}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function DeliveryPlannerClient({
  deliveries,
}: {
  deliveries: AdminDeliveriesResult;
}) {
  const [items, setItems] = useState(() => initialPlan(deliveries.bookings));
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const columns = useMemo(
    () => ({
      unassigned: columnItems(items, "unassigned"),
      truck1: columnItems(items, "truck-1"),
      truck2: columnItems(items, "truck-2"),
    }),
    [items],
  );
  const counts = statusCounts(items);

  const onAssign = (id: string, truck: TruckId) => {
    setItems((current) => {
      const assignedToTruck = current.filter(
        (item) => item.deliveryTruck === truck && item.id !== id,
      );
      return recalculatePlan(
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                deliveryTruck: truck,
                deliveryDate: item.deliveryDate ?? deliveries.date,
                trailerLoad: item.trailerLoad ?? 1,
                deliverySequence: assignedToTruck.length + 1,
                deliveryRouteStatus: "draft",
              }
            : item,
        ),
      );
    });
    setSaveStatus("idle");
  };

  const onDateChange = (id: string, date: string) => {
    setItems((current) =>
      recalculatePlan(
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                deliveryDate: date,
                deliveryRouteStatus: "draft",
              }
            : item,
        ),
      ),
    );
    setSaveStatus("idle");
  };

  const onLoadChange = (id: string, load: number) => {
    setItems((current) =>
      recalculatePlan(
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                trailerLoad: load,
                deliveryRouteStatus: "draft",
              }
            : item,
        ),
      ),
    );
    setSaveStatus("idle");
  };

  const onUnassign = (id: string) => {
    setItems((current) =>
      recalculatePlan(
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                deliveryTruck: null,
                trailerLoad: null,
                deliverySequence: null,
                plannedArrivalTime: null,
                plannedSetupStart: null,
                plannedSetupEnd: null,
                deliveryRouteStatus: "unplanned",
              }
            : item,
        ),
      ),
    );
    setSaveStatus("idle");
  };

  const onMove = (id: string, direction: -1 | 1) => {
    setItems((current) => moveWithinTruck(current, id, direction));
    setSaveStatus("idle");
  };

  const runAutoPlan = async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPlan: true, date: deliveries.date }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; plannedCount?: number }
        | null;
      if (!res.ok) throw new Error(data?.error || "Unable to auto-plan route.");
      setPlanMessage(
        `Truck plan saved. ${data?.plannedCount ?? 0} inflatables are assigned.`,
      );
      setSaveStatus("saved");
      window.location.reload();
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to auto-plan route.");
    }
  };

  const savePlan = async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: routeAssignments(items) }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Unable to save route plan.");
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to save route plan.");
    }
  };

  const printPlan = () => {
    if (isPrinting) return;
    setIsPrinting(true);
    window.print();
    window.setTimeout(() => setIsPrinting(false), 2500);
  };

  return (
    <>
      <section className="delivery-screen-only mt-6 rounded-xl border border-sky-200 bg-white p-4 shadow-sm print:hidden">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Start here</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Set each inflatable's delivery day, trailer, load, and order.
              Each printed load starts at the shop and returns to the shop.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:flex">
            <button type="button" onClick={runAutoPlan} className="rounded-xl bg-sky-600 px-5 py-4 text-left text-sm font-black text-white hover:bg-sky-700">
              <span className="block text-xs uppercase">Update</span>
              Rebuild and Save Plan
            </button>
            <button
              type="button"
              onClick={printPlan}
              disabled={isPrinting}
              className="rounded-xl bg-slate-950 px-5 py-4 text-left text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="block text-xs uppercase">Print</span>
              {isPrinting ? "Opening Print..." : "Print Load Sheets"}
            </button>
            <button type="button" onClick={savePlan} disabled={saveStatus === "saving"} className="rounded-xl bg-amber-300 px-5 py-4 text-left text-sm font-black text-amber-950 hover:bg-amber-200 disabled:opacity-60">
              <span className="block text-xs uppercase">Save</span>
              {saveStatus === "saving" ? "Saving..." : "Save This Plan"}
            </button>
          </div>
        </div>

        {planMessage && (
          <p className="mt-3 rounded-xl bg-sky-100 px-4 py-3 text-sm font-black text-sky-950">
            {planMessage} Short Trailer and Long Trailer are below.
          </p>
        )}

        <div className="mt-4 grid gap-2 text-sm font-black sm:grid-cols-3">
          <div className="rounded-xl bg-rose-100 px-3 py-2 text-rose-900">
            Needs attention: {counts.needsAttention}
          </div>
          <div className="rounded-xl bg-amber-100 px-3 py-2 text-amber-950">
            Close timing: {counts.closeTiming}
          </div>
          <div className="rounded-xl bg-emerald-100 px-3 py-2 text-emerald-950">
            Ready to print: {counts.ready}
          </div>
        </div>

        {saveStatus === "saved" && (
          <p className="mt-3 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-black text-emerald-900">
            Saved. These inflatable truck assignments will still be here when you reload.
          </p>
        )}
        {saveStatus === "error" && (
          <p className="mt-3 rounded-xl bg-rose-100 px-4 py-3 text-sm font-black text-rose-900">
            Save failed: {saveError}
          </p>
        )}
      </section>

      <div className="delivery-screen-only mt-6 grid gap-5 xl:grid-cols-3 print:hidden">
        <DeliveryColumn
          column="unassigned"
          items={columns.unassigned}
          plannerDate={deliveries.date}
          onDateChange={onDateChange}
          onLoadChange={onLoadChange}
          onAssign={onAssign}
          onUnassign={onUnassign}
          onMove={onMove}
        />
        <DeliveryColumn
          column="truck-1"
          items={columns.truck1}
          plannerDate={deliveries.date}
          onDateChange={onDateChange}
          onLoadChange={onLoadChange}
          onAssign={onAssign}
          onUnassign={onUnassign}
          onMove={onMove}
        />
        <DeliveryColumn
          column="truck-2"
          items={columns.truck2}
          plannerDate={deliveries.date}
          onDateChange={onDateChange}
          onLoadChange={onLoadChange}
          onAssign={onAssign}
          onUnassign={onUnassign}
          onMove={onMove}
        />
      </div>

      <section className="delivery-screen-only mt-5 grid gap-3 lg:grid-cols-2 print:hidden">
        <LoadMapLinks truck="truck-1" items={columns.truck1} />
        <LoadMapLinks truck="truck-2" items={columns.truck2} />
      </section>

      <section className="mt-5 rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="border-b border-slate-200 pb-4 print:hidden">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Print load sheets
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-slate-700">
              Prints a condensed trailer-load sheet with one small map and one
              tight table per load.
            </p>
          </div>
        </div>
        <div className="hidden print:block">
          <h1 className="text-3xl font-black text-slate-950">
            Jumping Jax Delivery Plan
          </h1>
          <p className="mt-1 text-lg font-bold text-slate-800">
            Date: {deliveries.date}
          </p>
        </div>
        <div className="mt-4 hidden gap-5 xl:grid-cols-2 print:mt-1 print:grid print:grid-cols-2 print:gap-2">
          <LoadSheet truck="truck-1" items={columns.truck1} />
          <LoadSheet truck="truck-2" items={columns.truck2} />
        </div>
      </section>

      <section className="delivery-screen-only mt-5 grid gap-3 lg:grid-cols-2 print:hidden">
        <div className="rounded-xl border border-sky-100 bg-white p-4">
          <p className="text-sm font-black text-slate-950">Multiple inflatables</p>
          <p className="mt-1 text-sm text-slate-600">
            If one customer booked more than one inflatable, each inflatable is
            listed so the crew knows exactly what goes on each truck.
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-4">
          <p className="text-sm font-black text-slate-950">How trucks are chosen</p>
          <p className="mt-1 text-sm text-slate-600">
            The planner starts with the customer address and party time, then
            balances the route between the Short Trailer and Long Trailer.
          </p>
        </div>
      </section>

    </>
  );
}
