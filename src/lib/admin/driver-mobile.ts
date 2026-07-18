import { getRentalBySlug } from "@/data/rentals";
import type {
  AdminDeliveryBooking,
  AdminDeliveryItem,
  AdminDeliveryWorkTask,
} from "./deliveries";
import {
  isTaskCompleted,
  printStopWorkLabel,
  sortDriverTasks,
} from "./driver-app";

export const DRIVER_SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";

export const DRIVER_ISSUE_CHOICES = [
  { id: "customer-unavailable", label: "Customer unavailable" },
  { id: "access-problem", label: "Access problem" },
  { id: "weather-issue", label: "Weather issue" },
  { id: "equipment-damage", label: "Equipment damage" },
  { id: "equipment-missing", label: "Equipment missing" },
  { id: "need-office", label: "Need office assistance" },
  { id: "other", label: "Other" },
] as const;

export type DriverIssueChoiceId = (typeof DRIVER_ISSUE_CHOICES)[number]["id"];

export const DELIVERY_COMPLETION_CHECKLIST = [
  { id: "equipment-delivered", label: "Equipment delivered" },
  { id: "setup-completed", label: "Setup completed" },
  { id: "location-confirmed", label: "Customer location confirmed" },
  { id: "condition-checked", label: "Equipment condition checked" },
  { id: "notes-entered", label: "Required notes entered" },
] as const;

export const PICKUP_COMPLETION_CHECKLIST = [
  { id: "equipment-collected", label: "All equipment collected" },
  { id: "accessories-accounted", label: "Accessories accounted for" },
  { id: "condition-checked", label: "Condition checked" },
  { id: "wet-damaged-noted", label: "Wet or damaged equipment noted" },
  { id: "return-notes", label: "Return-load notes recorded" },
] as const;

export type DriverMobileProgress = {
  total: number;
  completed: number;
  remaining: number;
};

export type DriverMobilePrimaryAction = {
  status: string;
  label: string;
  stage: "start" | "arrived" | "complete";
};

export type DriverTripEquipmentItem = {
  itemId: string;
  rentalName: string;
  rentalItem: string;
  imageSrc: string | null;
  isPrimary: boolean;
  isBigSlide: boolean;
  quantity: number | null;
  warning: string | null;
};

export function driverWorkTypeLabel(
  workType: AdminDeliveryWorkTask["workType"],
): string {
  return workType === "delivery" ? "Delivery" : "Pickup";
}

export function driverWorkTypeLongLabel(
  workType: AdminDeliveryWorkTask["workType"],
): string {
  return workType === "delivery" ? "Delivery / Setup" : printStopWorkLabel("pickup");
}

export function driverStatusLabel(status: string | null | undefined): string {
  const clean = status?.trim() || "planned";
  const labels: Record<string, string> = {
    planned: "Not started",
    "on-the-way": "En route",
    delivered: "Arrived",
    "setup-complete": "Completed",
    "picked-up": "Completed",
  };
  return labels[clean] ?? clean;
}

export function driverStatusStage(
  status: string | null | undefined,
): "not-started" | "en-route" | "arrived" | "completed" {
  const clean = status?.trim() || "planned";
  if (clean === "setup-complete" || clean === "picked-up") return "completed";
  if (clean === "delivered") return "arrived";
  if (clean === "on-the-way") return "en-route";
  return "not-started";
}

export function buildDriverMobileProgress(
  tasks: AdminDeliveryWorkTask[],
): DriverMobileProgress {
  const total = tasks.length;
  const completed = tasks.filter(isTaskCompleted).length;
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
  };
}

export function selectNextIncompleteTrip(
  tasks: AdminDeliveryWorkTask[],
): AdminDeliveryWorkTask | null {
  return sortDriverTasks(tasks).find((task) => !isTaskCompleted(task)) ?? null;
}

export function orderDriverMobileTrips(
  tasks: AdminDeliveryWorkTask[],
): AdminDeliveryWorkTask[] {
  const sorted = sortDriverTasks(tasks);
  const incomplete = sorted.filter((task) => !isTaskCompleted(task));
  const completed = sorted.filter(isTaskCompleted);
  return [...incomplete, ...completed];
}

export function groupDriverMobileTrips(tasks: AdminDeliveryWorkTask[]): {
  deliveries: AdminDeliveryWorkTask[];
  pickups: AdminDeliveryWorkTask[];
} {
  const ordered = orderDriverMobileTrips(tasks);
  return {
    deliveries: ordered.filter((task) => task.workType === "delivery"),
    pickups: ordered.filter((task) => task.workType === "pickup"),
  };
}

export function nextDriverMobileAction(args: {
  workType: AdminDeliveryWorkTask["workType"];
  routeStatus: string | null | undefined;
}): DriverMobilePrimaryAction | null {
  const status = args.routeStatus?.trim() || "planned";
  if (args.workType === "delivery") {
    if (status === "planned") {
      return { status: "on-the-way", label: "Start Trip", stage: "start" };
    }
    if (status === "on-the-way") {
      return { status: "delivered", label: "Arrived", stage: "arrived" };
    }
    if (status === "delivered") {
      return {
        status: "setup-complete",
        label: "Complete Delivery",
        stage: "complete",
      };
    }
    return null;
  }

  if (status === "planned") {
    return { status: "on-the-way", label: "Start Trip", stage: "start" };
  }
  if (status === "on-the-way") {
    return { status: "picked-up", label: "Complete Pickup", stage: "complete" };
  }
  return null;
}

export function isDriverMobileActionAvailable(args: {
  workType: AdminDeliveryWorkTask["workType"];
  routeStatus: string | null | undefined;
  actionStatus: string;
}): boolean {
  const next = nextDriverMobileAction(args);
  return next?.status === args.actionStatus;
}

export function buildNavigateUrl(
  address: string | null | undefined,
  origin: string = DRIVER_SHOP_ADDRESS,
): string | null {
  const destination = address?.trim();
  if (!destination) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

export function buildTelHref(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits ? `tel:${digits}` : null;
}

export function extractTownCity(address: string | null | undefined): string | null {
  const clean = address?.trim();
  if (!clean) return null;
  const parts = clean
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return parts[parts.length - 2] ?? null;
  }
  if (parts.length === 2) {
    const maybeCity = parts[1]?.replace(/\b[A-Z]{2}\b.*$/, "").trim();
    return maybeCity || parts[1] || null;
  }
  return null;
}

export function formatDriverMobileTime(value: string | null | undefined): string {
  if (!value?.trim()) return "Time not set";
  const [hourRaw, minuteRaw] = value.split(":").map(Number);
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return value;
  const hour = hourRaw % 12 || 12;
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  return `${hour}:${String(minuteRaw).padStart(2, "0")} ${suffix}`;
}

export function formatDriverMobileDate(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function tripScheduleLabel(task: AdminDeliveryWorkTask): string {
  const time = formatDriverMobileTime(
    task.plannedArrivalTime ?? task.workTime,
  );
  if (typeof task.sequence === "number") {
    return `Stop ${task.sequence} · ${time}`;
  }
  return time;
}

export function primaryRentalNames(task: AdminDeliveryWorkTask): string {
  return task.rentalName?.trim() || "Rental";
}

export function bookingItemsForTrip(
  task: AdminDeliveryWorkTask,
  booking: AdminDeliveryBooking | undefined,
): AdminDeliveryItem[] {
  if (!booking?.items?.length) {
    return [
      {
        id: task.itemId,
        rental_item: task.rentalItem,
        rental_name: task.rentalName,
        isBigSlide: task.isBigSlide,
        deliveryDate: null,
        deliveryTruck: null,
        trailerLoad: null,
        deliverySequence: null,
        plannedArrivalTime: null,
        plannedSetupStart: null,
        plannedSetupEnd: null,
        deliveryRouteStatus: null,
        deliveryRouteNotes: null,
        pickupDate: null,
        pickupTime: null,
        pickupTruck: null,
        pickupTrailerLoad: null,
        pickupSequence: null,
        pickupRouteStatus: null,
        pickupRouteNotes: null,
        estimatedSetupMinutes: task.estimatedSetupMinutes,
      },
    ];
  }
  return booking.items;
}

export function buildTripEquipmentItems(args: {
  task: AdminDeliveryWorkTask;
  booking?: AdminDeliveryBooking;
}): DriverTripEquipmentItem[] {
  const items = bookingItemsForTrip(args.task, args.booking);
  return items.map((item) => {
    const rental = getRentalBySlug(item.rental_item);
    return {
      itemId: item.id,
      rentalName: item.rental_name,
      rentalItem: item.rental_item,
      imageSrc: rental?.imageSrc ?? null,
      isPrimary: item.id === args.task.itemId,
      isBigSlide: item.isBigSlide,
      quantity: null,
      warning: item.isBigSlide ? "Big slide — allow extra setup time" : null,
    };
  });
}

export function tripItemCount(
  task: AdminDeliveryWorkTask,
  booking?: AdminDeliveryBooking,
): number {
  return bookingItemsForTrip(task, booking).length;
}

export function appendDriverIssueNote(args: {
  existingNotes: string | null | undefined;
  issueLabel: string;
  detail?: string | null;
  at?: Date;
}): string {
  const stamp = (args.at ?? new Date()).toISOString();
  const detail = args.detail?.trim();
  const issueLine = detail
    ? `[Issue ${stamp}] ${args.issueLabel}: ${detail}`
    : `[Issue ${stamp}] ${args.issueLabel}`;
  const existing = args.existingNotes?.trim();
  if (!existing) return issueLine;
  return `${existing}\n${issueLine}`;
}

export function completionChecklistForWorkType(
  workType: AdminDeliveryWorkTask["workType"],
) {
  return workType === "pickup"
    ? PICKUP_COMPLETION_CHECKLIST
    : DELIVERY_COMPLETION_CHECKLIST;
}

export function driverTripPrintSheetId(task: AdminDeliveryWorkTask): string {
  return `driver-trip-print-${task.itemId}-${task.workType}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
}

export function tripSheetIdsToSkip(
  allSheetIds: string[],
  targetSheetId?: string,
): string[] {
  if (!targetSheetId) return [];
  if (!allSheetIds.includes(targetSheetId)) return [...allSheetIds];
  return allSheetIds.filter((sheetId) => sheetId !== targetSheetId);
}

export function mobileSessionStorageKey(taskId: string, suffix: string): string {
  return `jjx-driver-mobile:${taskId}:${suffix}`;
}
