"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AdminDeliveriesResult,
  AdminDeliveryWorkTask,
} from "@/lib/admin/deliveries";
import {
  datesToSearchParams,
  formatLongDate,
  type PlannerWorkFilter,
  type WorkType,
} from "@/lib/admin/delivery-planner-dates";
import { formatStoredRentalTotal } from "@/lib/admin/delivery-print-layout";
import { rentalAppearsInRoutePlanner } from "@/lib/bookings/rental-lifecycle";

type TruckId = "truck-1" | "truck-2";
type ColumnId = "unassigned" | TruckId;

type PlannedInflatable = {
  id: string;
  itemId: string;
  bookingId: string;
  workType: WorkType;
  customerName: string;
  customerPhone: string | null;
  bookingStatus: string;
  total: number | null;
  eventDate: string;
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
  crossDateLabel: string | null;
  conflictMessages: string[];
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
  if (item.workType === "pickup") {
    if (!item.deliveryTruck) {
      return {
        warning: "unplanned",
        warningText: "Needs attention: assign this pickup to a trailer.",
      };
    }
    if (!item.plannedArrivalTime && !item.deliveryDate) {
      return {
        warning: "missing_time",
        warningText: "Needs attention: set a pickup time.",
      };
    }
    return {
      warning: "ok",
      warningText: "Pickup assigned for this work date.",
    };
  }

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

function asTruck(value: string | null | undefined): TruckId | null {
  return value === "truck-1" || value === "truck-2" ? value : null;
}

function taskToPlanned(task: AdminDeliveryWorkTask): PlannedInflatable {
  const base: PlannedInflatable = {
    id: task.id,
    itemId: task.itemId,
    bookingId: task.bookingId,
    workType: task.workType,
    customerName: task.customerName,
    customerPhone: task.customerPhone,
    bookingStatus: task.bookingStatus,
    total: task.total,
    eventDate: task.eventDate,
    eventStartTime: task.eventStartTime,
    requestedDeliveryWindow: task.requestedDeliveryWindow,
    eventAddress: task.eventAddress,
    distanceMiles: task.distanceMiles,
    setupLocation: task.setupLocation,
    setupSurface: task.setupSurface,
    setupAccess: task.setupAccess,
    setupNotes: task.setupNotes,
    singleStopMapUrl: task.singleStopMapUrl,
    rentalName: task.rentalName,
    rentalItem: task.rentalItem,
    isBigSlide: task.isBigSlide,
    deliveryDate: task.workDate,
    deliveryTruck: asTruck(task.truck),
    trailerLoad: task.trailerLoad,
    deliverySequence: task.sequence,
    plannedArrivalTime: task.plannedArrivalTime ?? task.workTime,
    plannedSetupStart: task.plannedSetupStart,
    plannedSetupEnd: task.plannedSetupEnd,
    deliveryRouteStatus: task.routeStatus,
    deliveryRouteNotes: task.routeNotes,
    estimatedSetupMinutes: task.estimatedSetupMinutes,
    crossDateLabel: task.crossDateLabel,
    conflictMessages: task.warnings.map((warning) => warning.message),
    warning: "unplanned",
    warningText: "Needs attention: assign this stop.",
  };
  return { ...base, ...evaluateWarning(base) };
}

function flattenDeliveries(deliveries: AdminDeliveriesResult): PlannedInflatable[] {
  const tasks = [...(deliveries.tasks ?? []), ...(deliveries.unscheduled ?? [])];
  return tasks
    .filter((task) => rentalAppearsInRoutePlanner(task.bookingStatus))
    .map(taskToPlanned);
}

function workScopeKey(item: PlannedInflatable) {
  return `${item.deliveryDate ?? "unscheduled"}:${item.workType}`;
}

function recalculatePlan(items: PlannedInflatable[]): PlannedInflatable[] {
  const byId = new Map<string, PlannedInflatable>();

  for (const item of items) {
    if (!item.deliveryTruck) {
      const unplanned = {
        ...item,
        deliverySequence: null,
        plannedArrivalTime: item.workType === "pickup" ? item.plannedArrivalTime : null,
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
    const truckItems = sortTruckItems(
      items.filter((item) => item.deliveryTruck === truck),
    );
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
        if (item.workType === "pickup") {
          const planned = {
            ...item,
            trailerLoad: loadNumber,
            deliverySequence: sequence,
            plannedArrivalTime: item.plannedArrivalTime,
            deliveryRouteStatus:
              item.deliveryRouteStatus === "planned" ? "planned" : "draft",
          };
          byId.set(item.id, { ...planned, ...evaluateWarning(planned) });
          sequence += 1;
          return;
        }

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

function recalculateScoped(
  allItems: PlannedInflatable[],
  scopeItems: PlannedInflatable[],
): PlannedInflatable[] {
  const recalculated = recalculatePlan(scopeItems);
  const byId = new Map(recalculated.map((item) => [item.id, item]));
  return allItems.map((item) => byId.get(item.id) ?? item);
}

function autoDraft(items: PlannedInflatable[]): PlannedInflatable[] {
  const scopes = new Map<string, PlannedInflatable[]>();
  for (const item of items) {
    const key = workScopeKey(item);
    scopes.set(key, [...(scopes.get(key) ?? []), item]);
  }

  let result = [...items];
  for (const scoped of scopes.values()) {
    const unassigned = scoped.filter((item) => !item.deliveryTruck);
    if (unassigned.length === 0) {
      result = recalculateScoped(result, scoped);
      continue;
    }

    const drafted = [...scoped]
      .sort(sortForRoute)
      .map((item, index) => {
        if (item.deliveryTruck) return item;
        return {
          ...item,
          deliveryTruck: preferredTruckForAddress(item.eventAddress),
          deliveryDate: item.deliveryDate,
          trailerLoad: item.trailerLoad ?? Math.floor(index / TRUCK_INFLATABLE_CAPACITY) + 1,
          deliveryRouteStatus: "draft",
        };
      });
    result = recalculateScoped(result, drafted);
  }
  return result;
}

function initialPlan(deliveries: AdminDeliveriesResult): PlannedInflatable[] {
  const flattened = flattenDeliveries(deliveries);
  const hasUnassigned = flattened.some(
    (item) => item.deliveryDate && !item.deliveryTruck,
  );
  return hasUnassigned ? autoDraft(flattened) : recalculatePlan(flattened);
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
  const scopeKey = workScopeKey(moving);
  const truckItems = sortTruckItems(
    items.filter(
      (item) =>
        item.deliveryTruck === moving.deliveryTruck &&
        workScopeKey(item) === scopeKey,
    ),
  );
  const index = truckItems.findIndex((item) => item.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= truckItems.length) return items;
  const reordered = [...truckItems];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex]!, reordered[index]!];
  const sequenceById = new Map(
    reordered.map((item, nextIndex) => [item.id, nextIndex + 1]),
  );
  const next = items.map((item) =>
    item.deliveryTruck === moving.deliveryTruck && workScopeKey(item) === scopeKey
      ? { ...item, deliverySequence: sequenceById.get(item.id) ?? null }
      : item,
  );
  return recalculateScoped(
    next,
    next.filter((item) => workScopeKey(item) === scopeKey),
  );
}

function routeAssignments(items: PlannedInflatable[]) {
  return items
    .filter((item) => item.deliveryDate)
    .map((item) => {
      if (item.workType === "pickup") {
        return {
          itemId: item.itemId,
          bookingId: item.bookingId,
          workType: "pickup" as const,
          pickupDate: item.deliveryDate,
          pickupTime: item.plannedArrivalTime,
          pickupTruck: item.deliveryTruck,
          pickupTrailerLoad: item.trailerLoad,
          pickupSequence: item.deliverySequence,
          pickupRouteStatus: item.deliveryRouteStatus ?? "planned",
          pickupRouteNotes: item.deliveryRouteNotes,
        };
      }
      return {
        id: item.bookingId,
        bookingId: item.bookingId,
        itemId: item.itemId,
        workType: "delivery" as const,
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
      };
    });
}

function deliveriesSignature(deliveries: AdminDeliveriesResult): string {
  return JSON.stringify({
    dates: deliveries.dates,
    tasks: (deliveries.tasks ?? []).map((task) => ({
      id: task.id,
      workDate: task.workDate,
      truck: task.truck,
      sequence: task.sequence,
      status: task.routeStatus,
    })),
    unscheduled: (deliveries.unscheduled ?? []).map((task) => task.id),
  });
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

function emailPlanHref(dates: string[], items: PlannedInflatable[]): string {
  const lines = [
    "Jumping Jax Delivery Plan",
    `Dates: ${dates.join(", ")}`,
    "",
  ];

  for (const date of dates) {
    lines.push(formatLongDate(date));
    for (const workType of ["delivery", "pickup"] as WorkType[]) {
      const dayItems = items.filter(
        (item) => item.deliveryDate === date && item.workType === workType,
      );
      if (dayItems.length === 0) continue;
      lines.push(workType === "delivery" ? "Deliveries / Setups" : "Pickups");
      for (const truck of TRUCKS) {
        const truckItems = dayItems.filter((item) => item.deliveryTruck === truck);
        lines.push(`  ${COLUMN_LABELS[truck]}`);
        if (truckItems.length === 0) {
          lines.push("  No stops.", "");
          continue;
        }
        chunkLoads(truckItems).forEach((load, index) => {
          lines.push(`  Load ${loadNumber(load, index + 1)} (${routeRangeLabel(load)})`);
          load.forEach((item) => {
            lines.push(
              `  ${item.deliverySequence ?? "?"}. ${item.customerName} - ${item.rentalName} - ${formatTime(item.plannedArrivalTime)} - ${item.eventAddress ?? "No address"}`,
            );
          });
          lines.push("");
        });
      }
    }
    lines.push("");
  }

  return `mailto:?subject=${encodeURIComponent(
    `Jumping Jax Route Plan - ${dates.join(", ")}`,
  )}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function LoadSheet({
  truck,
  items,
  dateLabel,
  workTypeLabel,
}: {
  truck: TruckId;
  items: PlannedInflatable[];
  dateLabel?: string;
  workTypeLabel?: string;
}) {
  const loads = chunkLoads(items);
  const truckLabel = COLUMN_LABELS[truck];

  return (
    <section className="delivery-print-sheet rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm print:break-inside-auto print:border-slate-900 print:p-0 print:shadow-none">
      <div className="delivery-print-trailer-head flex flex-wrap items-start justify-between gap-3 border-b-2 border-slate-200 pb-3 print:border-slate-900">
        <div>
          {dateLabel && (
            <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">
              {dateLabel}
            </p>
          )}
          <h3 className="text-2xl font-black text-slate-950">{truckLabel}</h3>
          {workTypeLabel && (
            <p className="mt-1 text-sm font-bold text-slate-700">{workTypeLabel}</p>
          )}
          <p className="mt-1 rounded-lg bg-slate-100 px-2 py-1 text-sm font-bold text-slate-800">
            {items.length} stop{items.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="delivery-print-loads mt-4 grid gap-4">
        {loads.length === 0 ? (
          <p className="text-sm font-bold text-slate-600">No stops on this trailer.</p>
        ) : (
          loads.map((load, index) => {
            const mapHref = routeUrl(load);
            return (
              <div
                key={`${truck}-${loadNumber(load, index + 1)}`}
                className="delivery-print-load rounded-xl border border-slate-300 bg-slate-50 p-4 print:border-slate-700"
              >
                <div className="delivery-print-load-head flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-lg font-black text-slate-950">
                    Load {loadNumber(load, index + 1)}
                  </h4>
                  <span className="text-sm font-bold text-slate-700">
                    {routeRangeLabel(load)}
                  </span>
                </div>
                <p className="delivery-print-shop-note mt-2 rounded-lg bg-rose-100 px-3 py-2 text-sm font-black text-rose-900">
                  Shop to stops to shop. Reload before next load.
                </p>
                {mapHref && (
                  <a
                    href={mapHref}
                    className="delivery-print-map-link mt-2 inline-flex rounded-lg bg-amber-200 px-3 py-2 text-sm font-black text-amber-950"
                  >
                    Open map
                  </a>
                )}
                <div className="delivery-print-table-wrap mt-3 overflow-x-auto rounded-xl border border-slate-300 bg-white">
                  <table className="delivery-print-table w-full border-collapse text-sm">
                    <colgroup>
                      <col className="delivery-print-col-stop" />
                      <col className="delivery-print-col-item" />
                      <col className="delivery-print-col-customer" />
                      <col className="delivery-print-col-phone" />
                      <col className="delivery-print-col-arrive" />
                      <col className="delivery-print-col-party" />
                      <col className="delivery-print-col-address" />
                      <col className="delivery-print-col-setup" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100 text-left text-xs font-black uppercase tracking-wide text-slate-700">
                        <th>Stop</th>
                        <th>Item</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Arrive</th>
                        <th>Event</th>
                        <th>Address</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {load.map((item) => (
                        <tr key={item.id}>
                          <td>{item.deliverySequence ?? "—"}</td>
                          <td>
                            {item.rentalName}
                            <div className="delivery-print-rental-total mt-1 text-xs font-black text-slate-900">
                              {formatStoredRentalTotal(item.total)}
                            </div>
                            <div className="text-xs font-bold text-slate-500">
                              {item.workType === "pickup" ? "Pickup" : "Delivery"} ·{" "}
                              {printWarningLabel(item.warning)}
                            </div>
                          </td>
                          <td>{item.customerName}</td>
                          <td>{item.customerPhone ?? "—"}</td>
                          <td>{formatTime(item.plannedArrivalTime)}</td>
                          <td>{item.eventDate}</td>
                          <td>{item.eventAddress ?? "—"}</td>
                          <td>
                            {item.crossDateLabel ?? item.setupNotes ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
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
  return (
    <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-black text-slate-950">{COLUMN_LABELS[truck]} maps</h3>
      <div className="mt-3 grid gap-2">
        {loads.length === 0 ? (
          <p className="text-sm font-bold text-slate-600">No mapped loads yet.</p>
        ) : (
          loads.map((load, index) => {
            const href = routeUrl(load);
            return href ? (
              <a
                key={`${truck}-map-${index}`}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-amber-200 px-3 py-2 text-sm font-black text-amber-950 hover:bg-amber-300"
              >
                Load {loadNumber(load, index + 1)} map
              </a>
            ) : null;
          })
        )}
      </div>
    </div>
  );
}

function InflatableCard({
  item,
  selectedDates,
  onMoveToDate,
  onLoadChange,
  onAssign,
  onUnassign,
  onMove,
}: {
  item: PlannedInflatable;
  selectedDates: string[];
  onMoveToDate: (id: string, date: string) => void;
  onLoadChange: (id: string, load: number) => void;
  onAssign: (id: string, truck: TruckId) => void;
  onUnassign: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  return (
    <article
      id={`job-${item.id}`}
      className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">
            Booking #{item.bookingId} · {item.bookingStatus}
          </p>
          <h3 className="mt-1 text-lg font-black leading-tight text-slate-950">
            {item.rentalName}
          </h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {item.customerName}
          </p>
        </div>
        <div className="grid gap-1 text-right">
          <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-black text-white">
            {item.workType === "pickup" ? "Pickup" : "Delivery / Setup"}
          </span>
          {item.deliverySequence && (
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">
              Stop {item.deliverySequence}
            </span>
          )}
        </div>
      </div>

      {item.crossDateLabel && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-950">
          {item.crossDateLabel}
        </p>
      )}

      <div className="mt-3 grid gap-2 rounded-xl bg-sky-50 p-3 text-sm">
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Event date</span>
          <span className="text-right font-black text-slate-950">{item.eventDate}</span>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Work date</span>
          <span className="text-right font-black text-slate-950">
            {item.deliveryDate ?? "Unscheduled"}
          </span>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Work time</span>
          <span className="text-right font-black text-slate-950">
            {formatTime(item.plannedArrivalTime)}
          </span>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Driver</span>
          <span className="text-right font-black text-slate-950">N/A</span>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Truck / Trailer</span>
          <span className="text-right font-black text-slate-950">
            {item.deliveryTruck ? COLUMN_LABELS[item.deliveryTruck] : "Unassigned"}
          </span>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-slate-600">Trailer load</span>
          <span className="text-right font-black text-slate-950">
            {item.trailerLoad ?? "—"}
          </span>
        </p>
      </div>

      <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-black ${warningClasses(item.warning)}`}>
        <span className="mr-2">{warningLabel(item.warning)}:</span>
        {item.warningText}
      </p>

      {item.conflictMessages.length > 0 && (
        <ul className="mt-2 grid gap-1 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-900">
          {item.conflictMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {item.eventAddress ?? "No address"}
      </p>
      {(item.setupNotes || item.deliveryRouteNotes) && (
        <p className="mt-2 text-sm font-semibold text-slate-700">
          Notes: {item.deliveryRouteNotes ?? item.setupNotes}
        </p>
      )}

      <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-black sm:grid-cols-3">
        <label className="grid gap-1 text-slate-700">
          Move to date
          <select
            value={item.deliveryDate ?? ""}
            onChange={(event) => {
              if (event.target.value) onMoveToDate(item.id, event.target.value);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-950"
          >
            <option value="" disabled>
              Select date
            </option>
            {selectedDates.map((date) => (
              <option key={date} value={date}>
                {formatLongDate(date)}
              </option>
            ))}
          </select>
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
  selectedDates,
  onMoveToDate,
  onLoadChange,
  onAssign,
  onUnassign,
  onMove,
}: {
  column: ColumnId;
  items: PlannedInflatable[];
  selectedDates: string[];
  onMoveToDate: (id: string, date: string) => void;
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
          <h3 className="text-lg font-black text-slate-950">
            {COLUMN_LABELS[column]}
          </h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {items.length} stop{items.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sky-200 bg-white p-5 text-sm font-bold text-slate-600">
            {column === "unassigned"
              ? "Every stop has a trailer."
              : "Assign stops here or auto-plan this day."}
          </div>
        ) : (
          items.map((item) => (
            <InflatableCard
              key={item.id}
              item={item}
              selectedDates={selectedDates}
              onMoveToDate={onMoveToDate}
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

function WorkBoard({
  title,
  items,
  selectedDates,
  onMoveToDate,
  onLoadChange,
  onAssign,
  onUnassign,
  onMove,
}: {
  title: string;
  items: PlannedInflatable[];
  selectedDates: string[];
  onMoveToDate: (id: string, date: string) => void;
  onLoadChange: (id: string, load: number) => void;
  onAssign: (id: string, truck: TruckId) => void;
  onUnassign: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      <div className="mt-3 grid gap-4 xl:grid-cols-3">
        {(["unassigned", "truck-1", "truck-2"] as ColumnId[]).map((column) => (
          <DeliveryColumn
            key={`${title}-${column}`}
            column={column}
            items={columnItems(items, column)}
            selectedDates={selectedDates}
            onMoveToDate={onMoveToDate}
            onLoadChange={onLoadChange}
            onAssign={onAssign}
            onUnassign={onUnassign}
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  );
}

export function DeliveryPlannerClient({
  deliveries,
}: {
  deliveries: AdminDeliveriesResult;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedDates = useMemo(
    () => (deliveries.dates?.length ? deliveries.dates : [deliveries.date]),
    [deliveries.dates, deliveries.date],
  );
  const [items, setItems] = useState(() => initialPlan(deliveries));
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [printDate, setPrintDate] = useState<string>("all");
  const [printTruck, setPrintTruck] = useState<string>("all");
  const [printWorkType, setPrintWorkType] = useState<string>("all");
  const currentSignature = useMemo(() => deliveriesSignature(deliveries), [deliveries]);
  const lastSignatureRef = useRef(currentSignature);

  const workFilter = (searchParams.get("work") ?? "all") as PlannerWorkFilter;
  const truckFilter = searchParams.get("truck") ?? "all";
  const loadFilter = searchParams.get("load") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";

  function updateFilter(key: string, value: string) {
    const params = datesToSearchParams(selectedDates, {
      work: key === "work" ? value : workFilter,
      truck: key === "truck" ? value : truckFilter,
      load: key === "load" ? value : loadFilter,
      status: key === "status" ? value : statusFilter,
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    function refreshVisiblePage() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    const params = new URLSearchParams();
    if (selectedDates.length === 1) {
      params.set("date", selectedDates[0]!);
    } else {
      params.set("dates", selectedDates.join(","));
      params.set("date", selectedDates[0]!);
    }

    const events = new EventSource(`/api/driver/events?${params.toString()}`);
    events.addEventListener("refresh", refreshVisiblePage);
    events.addEventListener("error", () => {
      events.close();
    });

    const fallback = window.setInterval(refreshVisiblePage, 30_000);
    window.addEventListener("focus", refreshVisiblePage);

    return () => {
      events.close();
      window.clearInterval(fallback);
      window.removeEventListener("focus", refreshVisiblePage);
    };
  }, [router, selectedDates]);

  useEffect(() => {
    if (lastSignatureRef.current === currentSignature) return;
    lastSignatureRef.current = currentSignature;

    startTransition(() => {
      if (hasLocalEdits) {
        setPlanMessage(
          "New route data is available. Save this plan, or reload the page to pull in the latest bookings.",
        );
        return;
      }

      setItems(initialPlan(deliveries));
      setSaveStatus("idle");
      setSaveError(null);
      setPlanMessage("Route planner refreshed with the latest booking data.");
    });
  }, [currentSignature, deliveries, hasLocalEdits]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (workFilter === "deliveries" && item.workType !== "delivery") return false;
      if (workFilter === "pickups" && item.workType !== "pickup") return false;
      if (workFilter === "unscheduled" && item.deliveryDate) return false;
      if (truckFilter !== "all" && item.deliveryTruck !== truckFilter) return false;
      if (loadFilter !== "all" && String(item.trailerLoad ?? "") !== loadFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.bookingStatus !== statusFilter) return false;
      return true;
    });
  }, [items, workFilter, truckFilter, loadFilter, statusFilter]);

  const scheduledItems = useMemo(
    () => filteredItems.filter((item) => item.deliveryDate),
    [filteredItems],
  );
  const unscheduledItems = useMemo(
    () => filteredItems.filter((item) => !item.deliveryDate),
    [filteredItems],
  );
  const counts = statusCounts(scheduledItems);
  const emailHref = emailPlanHref(selectedDates, scheduledItems);

  const mutateScoped = (
    id: string,
    updater: (item: PlannedInflatable) => PlannedInflatable,
  ) => {
    setHasLocalEdits(true);
    setItems((current) => {
      const next = current.map((item) => (item.id === id ? updater(item) : item));
      const target = next.find((item) => item.id === id);
      if (!target?.deliveryDate) return next;
      const scope = next.filter(
        (item) => workScopeKey(item) === workScopeKey(target),
      );
      return recalculateScoped(next, scope);
    });
    setSaveStatus("idle");
  };

  const onAssign = (id: string, truck: TruckId) => {
    mutateScoped(id, (item) => ({
      ...item,
      deliveryTruck: truck,
      deliveryDate: item.deliveryDate ?? selectedDates[0] ?? deliveries.date,
      trailerLoad: item.trailerLoad ?? 1,
      deliveryRouteStatus: "draft",
    }));
  };

  const onMoveToDate = (id: string, date: string) => {
    mutateScoped(id, (item) => ({
      ...item,
      deliveryDate: date,
      deliveryRouteStatus: "draft",
    }));
    window.requestAnimationFrame(() => {
      document.getElementById(`job-${id}`)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  };

  const onLoadChange = (id: string, load: number) => {
    mutateScoped(id, (item) => ({
      ...item,
      trailerLoad: load,
      deliveryRouteStatus: "draft",
    }));
  };

  const onUnassign = (id: string) => {
    mutateScoped(id, (item) => ({
      ...item,
      deliveryTruck: null,
      trailerLoad: null,
      deliverySequence: null,
      plannedArrivalTime: item.workType === "pickup" ? item.plannedArrivalTime : null,
      plannedSetupStart: null,
      plannedSetupEnd: null,
      deliveryRouteStatus: "unplanned",
    }));
  };

  const onMove = (id: string, direction: -1 | 1) => {
    setHasLocalEdits(true);
    setItems((current) => moveWithinTruck(current, id, direction));
    setSaveStatus("idle");
  };

  const runAutoPlan = async (date: string) => {
    setSaveStatus("saving");
    setSaveError(null);
    setPlanMessage(null);
    try {
      const res = await fetch("/api/admin/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoPlan: true,
          date,
          dates: selectedDates,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; plannedCount?: number; message?: string }
        | null;
      if (!res.ok) throw new Error(data?.error || "Unable to auto-plan route.");

      if (data?.message && (data.plannedCount ?? 0) === 0) {
        setPlanMessage(data.message);
        setSaveStatus("idle");
        setHasLocalEdits(false);
        return;
      }

      setPlanMessage(
        data?.message ??
          `Truck plan saved for ${formatLongDate(date)}. ${data?.plannedCount ?? 0} inflatables assigned.`,
      );
      setSaveStatus("saved");
      setHasLocalEdits(false);
      router.refresh();
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
      setHasLocalEdits(false);
      setPlanMessage("Plan saved. Event dates were not changed.");
      router.refresh();
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

  const printItems = scheduledItems.filter((item) => {
    if (printDate !== "all" && item.deliveryDate !== printDate) return false;
    if (printTruck !== "all" && item.deliveryTruck !== printTruck) return false;
    if (printWorkType !== "all" && item.workType !== printWorkType) return false;
    return true;
  });
  const printDates =
    printDate === "all"
      ? selectedDates
      : selectedDates.filter((date) => date === printDate);

  return (
    <>
      <section className="delivery-screen-only mt-6 rounded-xl border border-sky-200 bg-white p-4 shadow-sm print:hidden">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Start here</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Selected window: {selectedDates.map(formatLongDate).join(" · ")}.
              Routes stay separate by work date. Moving a stop only changes the
              operational work date.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex">
            <button
              type="button"
              onClick={() => runAutoPlan(selectedDates[0]!)}
              className="rounded-xl bg-sky-600 px-5 py-4 text-left text-sm font-black text-white hover:bg-sky-700"
            >
              <span className="block text-xs uppercase">Update</span>
              Auto-Plan First Date
            </button>
            <a
              href={emailHref}
              className="rounded-xl bg-violet-600 px-5 py-4 text-left text-sm font-black text-white hover:bg-violet-700"
            >
              <span className="block text-xs uppercase">Email</span>
              Email Route Plan
            </a>
            <button
              type="button"
              onClick={printPlan}
              disabled={isPrinting}
              className="rounded-xl bg-slate-950 px-5 py-4 text-left text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="block text-xs uppercase">Print</span>
              {isPrinting ? "Opening Print..." : "Print Load Sheets"}
            </button>
            <button
              type="button"
              onClick={savePlan}
              disabled={saveStatus === "saving"}
              className="rounded-xl bg-amber-300 px-5 py-4 text-left text-sm font-black text-amber-950 hover:bg-amber-200 disabled:opacity-60"
            >
              <span className="block text-xs uppercase">Save</span>
              {saveStatus === "saving" ? "Saving..." : "Save This Plan"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-black uppercase text-slate-600">
            Work
            <select
              value={workFilter}
              onChange={(event) => updateFilter("work", event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-950"
            >
              <option value="all">All work</option>
              <option value="deliveries">Deliveries / setups</option>
              <option value="pickups">Pickups</option>
              <option value="unscheduled">Unscheduled</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-600">
            Trailer
            <select
              value={truckFilter}
              onChange={(event) => updateFilter("truck", event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-950"
            >
              <option value="all">All trailers</option>
              <option value="truck-1">Short Trailer</option>
              <option value="truck-2">Long Trailer</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-600">
            Load
            <select
              value={loadFilter}
              onChange={(event) => updateFilter("load", event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-950"
            >
              <option value="all">All loads</option>
              <option value="1">Load 1</option>
              <option value="2">Load 2</option>
              <option value="3">Load 3</option>
              <option value="4">Load 4</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-600">
            Booking status
            <select
              value={statusFilter}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-950"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
          </label>
        </div>

        {planMessage && (
          <p className="mt-3 rounded-xl bg-sky-100 px-4 py-3 text-sm font-black text-sky-950">
            {planMessage}
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
            Saved. Work-date changes are persistent; event dates unchanged.
          </p>
        )}
        {saveStatus === "error" && (
          <p className="mt-3 rounded-xl bg-rose-100 px-4 py-3 text-sm font-black text-rose-900">
            Save failed: {saveError}
          </p>
        )}

        {(deliveries.warnings?.length ?? 0) > 0 && (
          <ul className="mt-3 grid gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-950">
            {deliveries.warnings.slice(0, 8).map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        )}
      </section>

      {(workFilter === "all" || workFilter === "unscheduled") &&
        unscheduledItems.length > 0 && (
          <section className="delivery-screen-only mt-6 rounded-2xl border border-rose-200 bg-white p-4 shadow-sm print:hidden">
            <h2 className="text-2xl font-black text-slate-950">Unscheduled Work</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Jobs in this window that still need a delivery/setup or pickup date.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {unscheduledItems.map((item) => (
                <InflatableCard
                  key={item.id}
                  item={item}
                  selectedDates={selectedDates}
                  onMoveToDate={onMoveToDate}
                  onLoadChange={onLoadChange}
                  onAssign={onAssign}
                  onUnassign={onUnassign}
                  onMove={onMove}
                />
              ))}
            </div>
          </section>
        )}

      {workFilter !== "unscheduled" &&
        selectedDates.map((date) => {
          const dayDeliveries = scheduledItems.filter(
            (item) =>
              item.deliveryDate === date &&
              item.workType === "delivery" &&
              workFilter !== "pickups",
          );
          const dayPickups = scheduledItems.filter(
            (item) =>
              item.deliveryDate === date &&
              item.workType === "pickup" &&
              workFilter !== "deliveries",
          );
          const collapsed = collapsedDates[date] ?? false;
          return (
            <section
              key={date}
              id={`date-${date}`}
              className="delivery-screen-only mt-6 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm print:hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">
                    {formatLongDate(date)}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-slate-600">
                    {dayDeliveries.length} deliveries/setups · {dayPickups.length}{" "}
                    pickups
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runAutoPlan(date)}
                    className="rounded-full bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-700"
                  >
                    Auto-plan this day
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedDates((current) => ({
                        ...current,
                        [date]: !collapsed,
                      }))
                    }
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-800"
                  >
                    {collapsed ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>
              {!collapsed && (
                <>
                  {(workFilter === "all" || workFilter === "deliveries") && (
                    <WorkBoard
                      title="Deliveries / Setups"
                      items={dayDeliveries}
                      selectedDates={selectedDates}
                      onMoveToDate={onMoveToDate}
                      onLoadChange={onLoadChange}
                      onAssign={onAssign}
                      onUnassign={onUnassign}
                      onMove={onMove}
                    />
                  )}
                  {(workFilter === "all" || workFilter === "pickups") && (
                    <WorkBoard
                      title="Pickups"
                      items={dayPickups}
                      selectedDates={selectedDates}
                      onMoveToDate={onMoveToDate}
                      onLoadChange={onLoadChange}
                      onAssign={onAssign}
                      onUnassign={onUnassign}
                      onMove={onMove}
                    />
                  )}
                  <section className="mt-5 grid gap-3 lg:grid-cols-2">
                    <LoadMapLinks
                      truck="truck-1"
                      items={[...dayDeliveries, ...dayPickups].filter(
                        (item) => item.deliveryTruck === "truck-1",
                      )}
                    />
                    <LoadMapLinks
                      truck="truck-2"
                      items={[...dayDeliveries, ...dayPickups].filter(
                        (item) => item.deliveryTruck === "truck-2",
                      )}
                    />
                  </section>
                </>
              )}
            </section>
          );
        })}

      <section className="delivery-print-root mt-5 rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm print:mt-0 print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Print load sheets
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-slate-700">
              Print all selected dates, one date, or one trailer for one date.
              Each day starts on its own page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={printDate}
              onChange={(event) => setPrintDate(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
            >
              <option value="all">All selected dates</option>
              {selectedDates.map((date) => (
                <option key={date} value={date}>
                  {formatLongDate(date)}
                </option>
              ))}
            </select>
            <select
              value={printTruck}
              onChange={(event) => setPrintTruck(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
            >
              <option value="all">All trailers</option>
              <option value="truck-1">Short Trailer</option>
              <option value="truck-2">Long Trailer</option>
            </select>
            <select
              value={printWorkType}
              onChange={(event) => setPrintWorkType(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
            >
              <option value="all">Deliveries + pickups</option>
              <option value="delivery">Deliveries only</option>
              <option value="pickup">Pickups only</option>
            </select>
            <button
              type="button"
              onClick={printPlan}
              disabled={isPrinting}
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPrinting ? "Opening Print..." : "Open Print Preview"}
            </button>
          </div>
        </div>

        <div className="hidden print:block">
          {printDates.map((date, dateIndex) => {
            const dayItems = printItems.filter((item) => item.deliveryDate === date);
            const deliveriesForDay = dayItems.filter(
              (item) => item.workType === "delivery",
            );
            const pickupsForDay = dayItems.filter((item) => item.workType === "pickup");
            return (
              <div
                key={date}
                className={`delivery-print-day ${dateIndex > 0 ? "delivery-print-day-break" : ""}`}
              >
                <h1 className="text-3xl font-black text-slate-950">
                  Jumping Jax Route Plan
                </h1>
                <p className="mt-1 text-lg font-bold text-slate-800">
                  {formatLongDate(date)}
                </p>
                {(printWorkType === "all" || printWorkType === "delivery") &&
                  (printTruck === "all" || printTruck === "truck-1") && (
                    <LoadSheet
                      truck="truck-1"
                      items={deliveriesForDay.filter(
                        (item) => item.deliveryTruck === "truck-1",
                      )}
                      dateLabel={formatLongDate(date)}
                      workTypeLabel="Drop-off"
                    />
                  )}
                {(printWorkType === "all" || printWorkType === "delivery") &&
                  (printTruck === "all" || printTruck === "truck-2") && (
                    <LoadSheet
                      truck="truck-2"
                      items={deliveriesForDay.filter(
                        (item) => item.deliveryTruck === "truck-2",
                      )}
                      dateLabel={formatLongDate(date)}
                      workTypeLabel="Drop-off"
                    />
                  )}
                {(printWorkType === "all" || printWorkType === "pickup") &&
                  (printTruck === "all" || printTruck === "truck-1") && (
                    <LoadSheet
                      truck="truck-1"
                      items={pickupsForDay.filter(
                        (item) => item.deliveryTruck === "truck-1",
                      )}
                      dateLabel={formatLongDate(date)}
                      workTypeLabel="Pickup"
                    />
                  )}
                {(printWorkType === "all" || printWorkType === "pickup") &&
                  (printTruck === "all" || printTruck === "truck-2") && (
                    <LoadSheet
                      truck="truck-2"
                      items={pickupsForDay.filter(
                        (item) => item.deliveryTruck === "truck-2",
                      )}
                      dateLabel={formatLongDate(date)}
                      workTypeLabel="Pickup"
                    />
                  )}
              </div>
            );
          })}
        </div>
      </section>

      <style>{`
        @page {
          size: letter landscape;
          margin: 0.35in;
        }

        @media print {
          .delivery-print-root {
            width: 100%;
          }

          .delivery-print-day-break {
            break-before: page;
          }

          .delivery-print-sheet {
            break-inside: auto;
            break-after: page;
          }

          .delivery-print-sheet + .delivery-print-sheet {
            break-before: page;
          }

          .delivery-print-sheet:last-child {
            break-after: auto;
          }

          .delivery-print-trailer-head {
            padding-bottom: 0.08in;
          }

          .delivery-print-trailer-head h3 {
            font-size: 16pt;
            line-height: 1.1;
          }

          .delivery-print-loads {
            margin-top: 0.1in;
            gap: 0.12in;
          }

          .delivery-print-load {
            break-inside: avoid;
            padding: 0.1in;
            background: #fff;
          }

          .delivery-print-table {
            table-layout: fixed;
            width: 100%;
            font-size: 7.5pt;
            line-height: 1.2;
          }

          .delivery-print-table th,
          .delivery-print-table td {
            padding: 0.04in;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
            border-bottom: 1px solid #cbd5e1;
          }

          .delivery-print-col-stop { width: 5%; }
          .delivery-print-col-item { width: 17%; }
          .delivery-print-col-customer { width: 12%; }
          .delivery-print-col-phone { width: 10%; }
          .delivery-print-col-arrive { width: 8%; }
          .delivery-print-col-party { width: 8%; }
          .delivery-print-col-address { width: 20%; }
          .delivery-print-col-setup { width: 20%; }
        }
      `}</style>
    </>
  );
}
