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
  singleStopMapUrl: string | null;
  rentalName: string;
  rentalItem: string;
  isBigSlide: boolean;
  deliveryTruck: TruckId | null;
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
  unassigned: "Needs a Truck",
  "truck-1": "Truck 1",
  "truck-2": "Truck 2",
};
const DAY_START_MINUTES = 7 * 60;
const FIRST_DRIVE_MINUTES = 45;
const BETWEEN_STOPS_MINUTES = 30;
const TARGET_READY_BUFFER_MINUTES = 60;
const MIN_READY_BUFFER_MINUTES = 45;
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

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", SHOP_ADDRESS);
  url.searchParams.set("destination", stops[stops.length - 1]!);
  url.searchParams.set("travelmode", "driving");
  if (stops.length > 1) {
    url.searchParams.set("waypoints", stops.slice(0, -1).join("|"));
  }
  return url.toString();
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

function routeEmbedUrl(items: PlannedInflatable[]): string | null {
  const stops = uniqueStops(items);
  if (stops.length === 0) return null;

  const url = new URL("https://maps.google.com/maps");
  url.searchParams.set("f", "d");
  url.searchParams.set("source", "s_d");
  url.searchParams.set("saddr", SHOP_ADDRESS);
  url.searchParams.set("daddr", stops.join(" to: "));
  url.searchParams.set("output", "embed");
  return url.toString();
}

function evaluateWarning(
  item: PlannedInflatable,
): Pick<PlannedInflatable, "warning" | "warningText"> {
  const partyStart = minutesFromTime(item.eventStartTime);
  const setupEnd = minutesFromTime(item.plannedSetupEnd);

  if (partyStart == null) {
    return {
      warning: "missing_time",
      warningText: "Fix this first: no official party start time.",
    };
  }
  if (setupEnd == null) {
    return {
      warning: "unplanned",
      warningText: "Needs a truck before timing can be checked.",
    };
  }

  const buffer = partyStart - setupEnd;
  if (buffer < 0) {
    return {
      warning: "late",
      warningText: `Problem: setup ends ${Math.abs(buffer)} min after party starts.`,
    };
  }
  if (buffer < MIN_READY_BUFFER_MINUTES) {
    return {
      warning: "late",
      warningText: `Problem: only ${buffer} min before party starts.`,
    };
  }
  if (buffer < TARGET_READY_BUFFER_MINUTES) {
    return {
      warning: "tight",
      warningText: `Watch closely: ${buffer} min before party starts.`,
    };
  }
  return {
    warning: "ok",
    warningText: `Good: ready ${buffer} min before party starts.`,
  };
}

function sortByPartyStart(a: PlannedInflatable, b: PlannedInflatable) {
  const aTime = minutesFromTime(a.eventStartTime) ?? 9999;
  const bTime = minutesFromTime(b.eventStartTime) ?? 9999;
  return aTime - bTime || a.customerName.localeCompare(b.customerName);
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
      singleStopMapUrl: booking.singleStopMapUrl,
      rentalName: item.rental_name,
      rentalItem: item.rental_item,
      isBigSlide: item.isBigSlide,
      deliveryTruck:
        item.deliveryTruck === "truck-1" || item.deliveryTruck === "truck-2"
          ? item.deliveryTruck
          : null,
      deliverySequence: item.deliverySequence,
      plannedArrivalTime: item.plannedArrivalTime,
      plannedSetupStart: item.plannedSetupStart,
      plannedSetupEnd: item.plannedSetupEnd,
      deliveryRouteStatus: item.deliveryRouteStatus,
      deliveryRouteNotes: item.deliveryRouteNotes,
      estimatedSetupMinutes: item.estimatedSetupMinutes,
      warning: "unplanned",
      warningText: "Needs a truck before timing can be checked.",
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
    let availableAt = DAY_START_MINUTES + FIRST_DRIVE_MINUTES;
    let inflatableCount = 0;
    let bigSlideCount = 0;
    let lastBookingId: string | null = null;

    sortTruckItems(items.filter((item) => item.deliveryTruck === truck)).forEach(
      (item, index) => {
        const sameStop = lastBookingId === item.bookingId;
        const setupStart = sameStop ? availableAt - BETWEEN_STOPS_MINUTES : availableAt;
        const setupEnd = setupStart + item.estimatedSetupMinutes;
        inflatableCount += 1;
        bigSlideCount += item.isBigSlide ? 1 : 0;

        const planned = {
          ...item,
          deliverySequence: index + 1,
          plannedArrivalTime: timeFromMinutes(setupStart),
          plannedSetupStart: timeFromMinutes(setupStart),
          plannedSetupEnd: timeFromMinutes(setupEnd),
          deliveryRouteStatus:
            item.deliveryRouteStatus === "planned" ? "planned" : "draft",
        };
        const capacityWarning =
          inflatableCount > TRUCK_INFLATABLE_CAPACITY ||
          bigSlideCount > TRUCK_BIG_SLIDE_CAPACITY;

        byId.set(
          item.id,
          capacityWarning
            ? {
                ...planned,
                warning: "capacity",
                warningText:
                  "Truck has more than 3 inflatables. Plan a second load or move this inflatable.",
              }
            : { ...planned, ...evaluateWarning(planned) },
        );

        availableAt = setupEnd + (sameStop ? 0 : BETWEEN_STOPS_MINUTES);
        lastBookingId = item.bookingId;
      },
    );
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

  return [...items].sort(sortByPartyStart).map((item) => {
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
    const setupStart = state.availableAt;
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
  if (warning === "ok") return "GOOD";
  if (warning === "tight") return "WATCH";
  if (warning === "unplanned") return "NOT PLANNED";
  return "FIX";
}

function statusCounts(items: PlannedInflatable[]) {
  return items.reduce(
    (counts, item) => {
      if (!item.deliveryTruck) counts.unassigned += 1;
      if (item.warning === "late" || item.warning === "capacity") counts.fix += 1;
      if (item.warning === "tight") counts.watch += 1;
      if (item.warning === "ok") counts.good += 1;
      return counts;
    },
    { unassigned: 0, fix: 0, watch: 0, good: 0 },
  );
}

function InflatableCard({
  item,
  onAssign,
  onUnassign,
  onMove,
}: {
  item: PlannedInflatable;
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

      <div className="mt-4 grid gap-2 text-sm font-black sm:grid-cols-2">
        {item.deliveryTruck ? (
          <>
            <button type="button" onClick={() => onMove(item.id, -1)} className="rounded-xl bg-white px-3 py-3 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50">
              Move Earlier
            </button>
            <button type="button" onClick={() => onMove(item.id, 1)} className="rounded-xl bg-white px-3 py-3 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50">
              Move Later
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onAssign(item.id, "truck-1")} className="rounded-xl bg-sky-600 px-3 py-3 text-white hover:bg-sky-700">
              Put on Truck 1
            </button>
            <button type="button" onClick={() => onAssign(item.id, "truck-2")} className="rounded-xl bg-sky-600 px-3 py-3 text-white hover:bg-sky-700">
              Put on Truck 2
            </button>
          </>
        )}
        {item.deliveryTruck && (
          <button type="button" onClick={() => onUnassign(item.id)} className="rounded-xl bg-slate-100 px-3 py-3 text-slate-700 hover:bg-slate-200">
            Remove from Truck
          </button>
        )}
        {item.singleStopMapUrl && (
          <a href={item.singleStopMapUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-amber-200 px-3 py-3 text-center text-amber-950 hover:bg-amber-300">
            Open Stop Map
          </a>
        )}
      </div>
    </article>
  );
}

function DeliveryColumn({
  column,
  items,
  onAssign,
  onUnassign,
  onMove,
}: {
  column: ColumnId;
  items: PlannedInflatable[];
  onAssign: (id: string, truck: TruckId) => void;
  onUnassign: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const mapUrl = column !== "unassigned" ? routeUrl(items) : null;
  const mapEmbedUrl = column !== "unassigned" ? routeEmbedUrl(items) : null;
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
        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-amber-950 hover:bg-amber-200">
            Open Route
          </a>
        )}
      </div>
      {mapEmbedUrl && (
        <div className="mb-3 overflow-hidden rounded-xl border border-sky-200 bg-white">
          <iframe
            title={`${COLUMN_LABELS[column]} stop map`}
            src={mapEmbedUrl}
            className="h-72 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="border-t border-sky-100 p-3 text-sm font-bold text-slate-700">
            Map shows each customer stop once, in the order listed below.
          </div>
        </div>
      )}
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
  token,
}: {
  deliveries: AdminDeliveriesResult;
  token: string;
}) {
  const [items, setItems] = useState(() => initialPlan(deliveries.bookings));
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  const columns = useMemo(
    () => ({
      unassigned: columnItems(items, "unassigned"),
      truck1: columnItems(items, "truck-1"),
      truck2: columnItems(items, "truck-2"),
    }),
    [items],
  );
  const counts = statusCounts(items);
  const truck1Route = routeUrl(columns.truck1);
  const truck2Route = routeUrl(columns.truck2);
  const truck1Map = routeEmbedUrl(columns.truck1);
  const truck2Map = routeEmbedUrl(columns.truck2);

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
                deliverySequence: assignedToTruck.length + 1,
                deliveryRouteStatus: "draft",
              }
            : item,
        ),
      );
    });
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

  const runAutoPlan = () => {
    const next = autoDraft(items);
    const plannedCount = next.filter((item) => item.deliveryTruck).length;
    setItems(next);
    setPlanMessage(`Auto-Plan is done. ${plannedCount} inflatables have trucks.`);
    setSaveStatus("idle");
  };

  const savePlan = async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, assignments: routeAssignments(items) }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Unable to save route plan.");
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to save route plan.");
    }
  };

  return (
    <>
      <section className="mt-6 rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Start here</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">
              This page automatically puts every inflatable on a truck when it
              loads. Fix any red cards, then click Save.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex">
            <button type="button" onClick={runAutoPlan} className="rounded-xl bg-sky-600 px-5 py-4 text-left text-sm font-black text-white hover:bg-sky-700">
              <span className="block text-xs uppercase">Optional</span>
              Recalculate Truck Plan
            </button>
            <button type="button" onClick={savePlan} disabled={saveStatus === "saving"} className="rounded-xl bg-amber-300 px-5 py-4 text-left text-sm font-black text-amber-950 hover:bg-amber-200 disabled:opacity-60">
              <span className="block text-xs uppercase">Save</span>
              {saveStatus === "saving" ? "Saving..." : "Save This Plan"}
            </button>
          </div>
        </div>

        {planMessage && (
          <p className="mt-3 rounded-xl bg-sky-100 px-4 py-3 text-sm font-black text-sky-950">
            {planMessage} Truck 1 and Truck 2 are below.
          </p>
        )}

        <div className="mt-4 grid gap-2 text-sm font-black sm:grid-cols-4">
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-slate-800">
            No truck: {counts.unassigned}
          </div>
          <div className="rounded-xl bg-rose-100 px-3 py-2 text-rose-900">
            Fix: {counts.fix}
          </div>
          <div className="rounded-xl bg-amber-100 px-3 py-2 text-amber-950">
            Watch: {counts.watch}
          </div>
          <div className="rounded-xl bg-emerald-100 px-3 py-2 text-emerald-950">
            Good: {counts.good}
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

      <section className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-sky-100 bg-white p-4">
          <p className="text-sm font-black text-slate-950">What changed</p>
          <p className="mt-1 text-sm text-slate-600">
            Multi-item bookings are split here so each inflatable gets its own truck.
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-4">
          <p className="text-sm font-black text-slate-950">Auto-Plan rule</p>
          <p className="mt-1 text-sm text-slate-600">
            Truck 2 leans west toward Abbeville/Donalds/Due West/Bradley. Truck
            1 leans Greenwood, then the plan balances timing.
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-4">
          <p className="text-sm font-black text-slate-950">Open maps</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm font-black">
            {truck1Route && <a href={truck1Route} target="_blank" rel="noreferrer" className="rounded-xl bg-amber-200 px-3 py-2 text-amber-950 hover:bg-amber-300">Truck 1 Route</a>}
            {truck2Route && <a href={truck2Route} target="_blank" rel="noreferrer" className="rounded-xl bg-amber-200 px-3 py-2 text-amber-950 hover:bg-amber-300">Truck 2 Route</a>}
            {!truck1Route && !truck2Route && <span className="text-slate-600">Routes appear after planning.</span>}
          </div>
        </div>
      </section>

      {(truck1Map || truck2Map) && (
        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          {truck1Map && (
            <div className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <h3 className="text-xl font-black text-slate-950">
                    Truck 1 Map
                  </h3>
                  <p className="text-sm font-bold text-slate-600">
                    Shows each stop in route order.
                  </p>
                </div>
                {truck1Route && (
                  <a
                    href={truck1Route}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-amber-200 px-3 py-2 text-sm font-black text-amber-950 hover:bg-amber-300"
                  >
                    Open
                  </a>
                )}
              </div>
              <iframe
                title="Truck 1 stop map"
                src={truck1Map}
                className="h-96 w-full border-t border-sky-100"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
          {truck2Map && (
            <div className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <h3 className="text-xl font-black text-slate-950">
                    Truck 2 Map
                  </h3>
                  <p className="text-sm font-bold text-slate-600">
                    Shows each stop in route order.
                  </p>
                </div>
                {truck2Route && (
                  <a
                    href={truck2Route}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-amber-200 px-3 py-2 text-sm font-black text-amber-950 hover:bg-amber-300"
                  >
                    Open
                  </a>
                )}
              </div>
              <iframe
                title="Truck 2 stop map"
                src={truck2Map}
                className="h-96 w-full border-t border-sky-100"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <DeliveryColumn column="unassigned" items={columns.unassigned} onAssign={onAssign} onUnassign={onUnassign} onMove={onMove} />
        <DeliveryColumn column="truck-1" items={columns.truck1} onAssign={onAssign} onUnassign={onUnassign} onMove={onMove} />
        <DeliveryColumn column="truck-2" items={columns.truck2} onAssign={onAssign} onUnassign={onUnassign} onMove={onMove} />
      </div>
    </>
  );
}
