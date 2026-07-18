import type {
  AdminDeliveryBooking,
  AdminDeliveryWorkTask,
} from "./deliveries";
import { printStopWorkLabel, truckLabel } from "./driver-app";
import {
  equipmentForItem,
  consolidateLoadEquipment,
  formatLoadEquipmentTotals,
  type LoadEquipmentItem,
  type LoadEquipmentTotals,
} from "./inventory-equipment";
import {
  emptyInventoryOperationalFields,
  extensionCordsFromBlowers,
  formatDimensions,
  formatEquipmentEntries,
  type InventoryOperationalFields,
} from "./inventory-ops";
import { MAX_TRAILER_INFLATABLES } from "./trailer-capacity";

export const DRIVER_TRIP_INFLATABLES_PER_PAGE = MAX_TRAILER_INFLATABLES;

export type DriverTripSheetSection = {
  sectionId: string;
  taskId: string;
  itemId: string;
  rentalName: string;
  imageSrc: string | null;
  workType: AdminDeliveryWorkTask["workType"];
  workTypeLabel: string;
  customerName: string;
  eventAddress: string;
  bookingReference: string;
  stopNumber: string;
  requestedTime: string;
  setupLocation: string | null;
  setupSurface: string | null;
  setupAccess: string | null;
  setupNotes: string | null;
  routeNotes: string | null;
  dimensionsLabel: string;
  blowersLabel: string;
  cordsLabel: string;
  tarpsLabel: string;
  suppliesLabel: string;
  ops: InventoryOperationalFields;
};

export type DriverTripSheetPage = {
  pageId: string;
  truck: string;
  trailerLoad: number;
  workType: AdminDeliveryWorkTask["workType"];
  workDate: string;
  truckAndLoadLabel: string;
  sections: DriverTripSheetSection[];
  loadTotals: LoadEquipmentTotals;
  loadTotalsLines: string[];
};

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean || /^(undefined|null)$/i.test(clean)) return null;
  return clean;
}

export function displayText(
  value: string | null | undefined,
  fallback = "Not provided",
): string {
  return cleanText(value) ?? fallback;
}

export function formatTripSheetDate(value: string | null | undefined): string {
  const clean = cleanText(value);
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return "Not provided";
  const [year, month, day] = clean.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month! - 1 ||
    date.getDate() !== day
  ) {
    return "Not provided";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTripSheetTime(value: string | null | undefined): string | null {
  const clean = cleanText(value);
  if (!clean) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(clean);
  if (!match) return clean;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return clean;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function shortBookingReference(bookingId: string): string {
  const clean = displayText(bookingId, "Unknown");
  return `#${clean.length > 8 ? clean.slice(-8) : clean}`;
}

function requestedTimeLabel(task: AdminDeliveryWorkTask): string {
  const arrival = formatTripSheetTime(task.plannedArrivalTime);
  const requestedWindow = cleanText(task.requestedDeliveryWindow);
  const eventTime = formatTripSheetTime(task.eventStartTime);
  const parts =
    task.workType === "pickup"
      ? [
          arrival ? `Pickup: ${arrival}` : null,
          eventTime ? `Event: ${eventTime}` : null,
        ]
      : [
          arrival ? `Arrival: ${arrival}` : null,
          requestedWindow ? `Requested: ${requestedWindow}` : null,
          eventTime ? `Event: ${eventTime}` : null,
        ];
  return parts.filter((part): part is string => part !== null).join(" · ") || "Not provided";
}

function opsForTask(task: AdminDeliveryWorkTask): InventoryOperationalFields {
  return task.inventoryOps ?? emptyInventoryOperationalFields(
    task.inventoryCategoryId ?? "bounce-houses",
  );
}

function suppliesLabel(ops: InventoryOperationalFields): string {
  const parts: string[] = [];
  if (ops.requiresSlideSpray) parts.push("Slide spray");
  if (ops.requiresDisinfectant) parts.push("Disinfectant");
  return parts.length > 0 ? parts.join(" · ") : "None";
}

function sectionFromTask(task: AdminDeliveryWorkTask): DriverTripSheetSection {
  const ops = opsForTask(task);
  const cords = extensionCordsFromBlowers(ops.blowers);
  return {
    sectionId: `trip-section-${task.id}`,
    taskId: task.id,
    itemId: task.itemId,
    rentalName: displayText(task.rentalName, "Rental item"),
    imageSrc: task.inventoryImageSrc ?? null,
    workType: task.workType,
    workTypeLabel:
      task.workType === "delivery" ? "Delivery / Setup" : printStopWorkLabel("pickup"),
    customerName: displayText(task.customerName),
    eventAddress: displayText(task.eventAddress),
    bookingReference: shortBookingReference(task.bookingId),
    stopNumber:
      typeof task.sequence === "number" ? String(task.sequence) : "—",
    requestedTime: requestedTimeLabel(task),
    setupLocation: cleanText(task.setupLocation),
    setupSurface: cleanText(task.setupSurface),
    setupAccess: cleanText(task.setupAccess),
    setupNotes: cleanText(task.setupNotes),
    routeNotes: cleanText(task.routeNotes),
    dimensionsLabel: formatDimensions(ops.dimensions),
    blowersLabel: formatEquipmentEntries(ops.blowers),
    cordsLabel: `${cords.cords100ft}× 100ft · ${cords.cords50ft}× 50ft`,
    tarpsLabel: formatEquipmentEntries(ops.tarps),
    suppliesLabel: suppliesLabel(ops),
    ops,
  };
}

function loadEquipmentItems(tasks: AdminDeliveryWorkTask[]): LoadEquipmentItem[] {
  return tasks.map((task) =>
    equipmentForItem({
      taskId: task.id,
      rentalItem: task.rentalItem,
      rentalName: task.rentalName,
      isInflatable: task.isInflatable !== false,
      ops: opsForTask(task),
    }),
  );
}

export function groupTasksIntoTripSheetPages(
  tasks: readonly AdminDeliveryWorkTask[],
): DriverTripSheetPage[] {
  const inflatableTasks = tasks.filter((task) => task.isInflatable !== false);
  const groups = new Map<string, AdminDeliveryWorkTask[]>();

  for (const task of inflatableTasks) {
    const truck = cleanText(task.truck);
    const load =
      typeof task.trailerLoad === "number" && Number.isFinite(task.trailerLoad)
        ? task.trailerLoad
        : 0;
    if (!truck || load <= 0) continue;
    const key = `${task.workDate ?? "unknown"}|${task.workType}|${truck}|${load}`;
    const existing = groups.get(key) ?? [];
    existing.push(task);
    groups.set(key, existing);
  }

  const pages: DriverTripSheetPage[] = [];
  for (const [, groupTasks] of [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (groupTasks.length === 0) continue;
    const sorted = [...groupTasks].sort((a, b) => {
      const seqA = a.sequence ?? Number.MAX_SAFE_INTEGER;
      const seqB = b.sequence ?? Number.MAX_SAFE_INTEGER;
      return seqA - seqB || a.rentalName.localeCompare(b.rentalName);
    });
    const sample = sorted[0]!;
    const truck = cleanText(sample.truck) ?? "unassigned";
    const trailerLoad = sample.trailerLoad ?? 0;
    const loadTotals = consolidateLoadEquipment(loadEquipmentItems(sorted));

    for (
      let index = 0;
      index < sorted.length;
      index += DRIVER_TRIP_INFLATABLES_PER_PAGE
    ) {
      const chunk = sorted.slice(index, index + DRIVER_TRIP_INFLATABLES_PER_PAGE);
      const pageIndex = Math.floor(index / DRIVER_TRIP_INFLATABLES_PER_PAGE) + 1;
      pages.push({
        pageId: `trip-page-${truck}-${trailerLoad}-${sample.workType}-${sample.workDate ?? "x"}-${pageIndex}`,
        truck,
        trailerLoad,
        workType: sample.workType,
        workDate: sample.workDate ?? "",
        truckAndLoadLabel: `${truckLabel(truck)} · Load ${trailerLoad}`,
        sections: chunk.map(sectionFromTask),
        loadTotals,
        loadTotalsLines: formatLoadEquipmentTotals(loadTotals),
      });
    }
  }

  return pages;
}

export function buildDriverTripSheetPages(args: {
  visibleTasks: AdminDeliveryWorkTask[];
  bookings?: AdminDeliveryBooking[];
}): DriverTripSheetPage[] {
  void args.bookings;
  return groupTasksIntoTripSheetPages(args.visibleTasks);
}

export function tripSheetPageIds(pages: readonly DriverTripSheetPage[]): string[] {
  return pages.map((page) => page.pageId);
}
