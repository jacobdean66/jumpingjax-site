import type { AdminDeliveryWorkTask } from "./deliveries";
import { DELIVERY_TRUCKS, type DeliveryTruckId } from "./deliveries";
import type { PlannerConflictWarning, WorkType } from "./delivery-planner-dates";
import {
  effectiveDeliveryWorkDate,
  effectivePickupWorkDate,
  todayYmd,
} from "./delivery-planner-dates";
import {
  buildPrintDayGroups,
  filterNonEmptyPrintLoads,
  printStopWorkLabel,
  type PrintPlanItem,
  type PrintTruckId,
} from "./delivery-print-layout";

export { printStopWorkLabel };

export const DRIVER_TRUCKS = [
  { id: "truck-1" as const, label: "Short Trailer" },
  { id: "truck-2" as const, label: "Long Trailer" },
] as const;

export type DriverTruckFilter = DeliveryTruckId | "unassigned";

export type DriverReadinessLevel = "hard" | "soft";

export type DriverReadinessWarning = {
  level: DriverReadinessLevel;
  code: string;
  taskId: string;
  message: string;
};

export type DriverRouteSummary = {
  totalWork: number;
  dropOffs: number;
  pickups: number;
  unassigned: number;
  inProgress: number;
  completed: number;
  withIssues: number;
};

export type DriverPrintStop = PrintPlanItem & {
  taskId: string;
  bookingId: string;
  customerName: string;
  customerPhone: string | null;
  eventAddress: string | null;
  plannedArrivalTime: string | null;
  eventStartTime: string | null;
  requestedDeliveryWindow: string | null;
  setupLocation: string | null;
  setupSurface: string | null;
  setupAccess: string | null;
  setupNotes: string | null;
  routeNotes: string | null;
  routeStatus: string | null;
  paymentMethod: string | null;
  total: number | null;
  paymentConfirmationNotes: string | null;
};

export type DriverPrintSheet = {
  sheetId: string;
  date: string;
  workType: WorkType;
  workTypeLabel: string;
  truck: PrintTruckId;
  truckLabel: string;
  load: number;
  stops: DriverPrintStop[];
};

const COMPLETED_STATUSES = new Set(["setup-complete", "picked-up"]);
const IN_PROGRESS_STATUSES = new Set(["on-the-way", "delivered"]);

export function isDeliveryTruckId(value: string | null | undefined): value is DeliveryTruckId {
  return value === "truck-1" || value === "truck-2";
}

export function normalizeDriverTruck(
  value: string | null | undefined,
): DriverTruckFilter | null {
  const clean = value?.trim().toLowerCase();
  if (!clean) return null;
  if (clean === "unassigned" || clean === "none") return "unassigned";
  if (clean === "truck-1" || clean === "truck 1" || clean === "1" || clean === "short") {
    return "truck-1";
  }
  if (clean === "truck-2" || clean === "truck 2" || clean === "2" || clean === "long") {
    return "truck-2";
  }
  return null;
}

export function truckLabel(truck: string): string {
  return DRIVER_TRUCKS.find((item) => item.id === truck)?.label ?? truck;
}

export function isTaskAssigned(task: Pick<AdminDeliveryWorkTask, "truck">): boolean {
  return isDeliveryTruckId(task.truck);
}

export function isTaskUnassigned(task: Pick<AdminDeliveryWorkTask, "truck">): boolean {
  return !isTaskAssigned(task);
}

export function isTaskCompleted(
  task: Pick<AdminDeliveryWorkTask, "routeStatus">,
): boolean {
  return COMPLETED_STATUSES.has(task.routeStatus ?? "");
}

export function isTaskInProgress(
  task: Pick<AdminDeliveryWorkTask, "routeStatus">,
): boolean {
  return IN_PROGRESS_STATUSES.has(task.routeStatus ?? "");
}

/** Tasks scheduled on the selected operational date (assigned or not). */
export function driverTasksForDate(
  tasks: AdminDeliveryWorkTask[],
  date: string,
): AdminDeliveryWorkTask[] {
  return tasks.filter((task) => task.workDate === date);
}

/**
 * Unassigned work for the date: scheduled tasks without a truck, plus
 * unscheduled tasks that belong to the day window (from the loader).
 */
export function unassignedDriverTasks(args: {
  tasks: AdminDeliveryWorkTask[];
  unscheduled: AdminDeliveryWorkTask[];
  date: string;
}): AdminDeliveryWorkTask[] {
  const fromScheduled = driverTasksForDate(args.tasks, args.date).filter(isTaskUnassigned);
  // Only truly unassigned unscheduled work — never surface truck-assigned
  // outside-window tasks in the Unassigned tab.
  const fromUnscheduled = args.unscheduled.filter(
    (task) =>
      isTaskUnassigned(task) &&
      (task.workDate === args.date || task.workDate === null),
  );
  const seen = new Set<string>();
  const result: AdminDeliveryWorkTask[] = [];
  for (const task of [...fromScheduled, ...fromUnscheduled]) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    result.push(task);
  }
  return result;
}

export function filterDriverTasksByTruck(
  tasks: AdminDeliveryWorkTask[],
  truck: DriverTruckFilter,
): AdminDeliveryWorkTask[] {
  if (truck === "unassigned") return tasks.filter(isTaskUnassigned);
  return tasks.filter((task) => task.truck === truck);
}

export function compareDriverTasks(
  a: AdminDeliveryWorkTask,
  b: AdminDeliveryWorkTask,
): number {
  const workTypeOrder = a.workType.localeCompare(b.workType);
  if (workTypeOrder !== 0) return workTypeOrder;
  const seqA = a.sequence ?? 999;
  const seqB = b.sequence ?? 999;
  if (seqA !== seqB) return seqA - seqB;
  const timeA = a.plannedArrivalTime ?? a.workTime ?? "99:99";
  const timeB = b.plannedArrivalTime ?? b.workTime ?? "99:99";
  const timeOrder = timeA.localeCompare(timeB);
  if (timeOrder !== 0) return timeOrder;
  return a.customerName.localeCompare(b.customerName);
}

export function sortDriverTasks(tasks: AdminDeliveryWorkTask[]): AdminDeliveryWorkTask[] {
  return [...tasks].sort(compareDriverTasks);
}

export function groupDriverTasksByTrailerLoad(
  tasks: AdminDeliveryWorkTask[],
): Array<{ load: number; tasks: AdminDeliveryWorkTask[] }> {
  const groups = new Map<number, AdminDeliveryWorkTask[]>();
  for (const task of tasks) {
    const load = task.trailerLoad ?? 1;
    groups.set(load, [...(groups.get(load) ?? []), task]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([load, loadTasks]) => ({
      load,
      tasks: sortDriverTasks(loadTasks),
    }));
}

export function buildDriverRouteSummary(args: {
  dateTasks: AdminDeliveryWorkTask[];
  unassigned: AdminDeliveryWorkTask[];
  closeoutIssueCount?: number;
}): DriverRouteSummary {
  const assigned = args.dateTasks.filter(isTaskAssigned);
  return {
    totalWork: args.dateTasks.length,
    dropOffs: args.dateTasks.filter((task) => task.workType === "delivery").length,
    pickups: args.dateTasks.filter((task) => task.workType === "pickup").length,
    unassigned: args.unassigned.length,
    inProgress: assigned.filter(isTaskInProgress).length,
    completed: assigned.filter(isTaskCompleted).length,
    withIssues: args.closeoutIssueCount ?? 0,
  };
}

export function buildDriverPageTitle(args: {
  date: string;
  today?: string;
}): string {
  const today = args.today ?? todayYmd();
  const [year, month, day] = args.date.split("-").map(Number);
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
  if (args.date === today) {
    return `Today's Route — ${formatted}`;
  }
  return `Route — ${formatted}`;
}

function fieldReadinessWarnings(
  task: AdminDeliveryWorkTask,
): DriverReadinessWarning[] {
  const warnings: DriverReadinessWarning[] = [];
  if (isTaskUnassigned(task)) {
    warnings.push({
      level: "hard",
      code: "missing_truck",
      taskId: task.id,
      message: `${task.customerName}: ${printStopWorkLabel(task.workType)} has no truck assigned.`,
    });
  }
  if (!task.eventAddress?.trim()) {
    warnings.push({
      level: "hard",
      code: "missing_address",
      taskId: task.id,
      message: `${task.customerName}: missing event address.`,
    });
  }
  if (!task.customerPhone?.trim()) {
    warnings.push({
      level: "hard",
      code: "missing_phone",
      taskId: task.id,
      message: `${task.customerName}: missing customer phone.`,
    });
  }
  if (isTaskAssigned(task) && (task.sequence === null || task.sequence === undefined)) {
    warnings.push({
      level: "soft",
      code: "missing_sequence",
      taskId: task.id,
      message: `${task.customerName}: ${printStopWorkLabel(task.workType)} is missing a route sequence.`,
    });
  }
  if (!task.workDate) {
    warnings.push({
      level: "hard",
      code: "missing_work_date",
      taskId: task.id,
      message: `${task.customerName}: ${printStopWorkLabel(task.workType)} is missing an operational date.`,
    });
  }
  return warnings;
}

export function collectDriverReadinessWarnings(args: {
  dateTasks: AdminDeliveryWorkTask[];
  unassigned: AdminDeliveryWorkTask[];
  plannerWarnings: PlannerConflictWarning[];
}): DriverReadinessWarning[] {
  const taskIds = new Set(
    [...args.dateTasks, ...args.unassigned].map((task) => task.id),
  );
  const fromFields = [...args.dateTasks, ...args.unassigned].flatMap(fieldReadinessWarnings);
  const fromPlanner: DriverReadinessWarning[] = args.plannerWarnings
    .filter((warning): warning is PlannerConflictWarning & { taskId: string } =>
      Boolean(warning.taskId && taskIds.has(warning.taskId)),
    )
    .map((warning) => ({
      level:
        warning.code === "resource_overlap" || warning.code === "duplicate_task"
          ? ("hard" as const)
          : ("soft" as const),
      code: warning.code,
      taskId: warning.taskId,
      message: warning.message,
    }));

  const seen = new Set<string>();
  const result: DriverReadinessWarning[] = [];
  for (const warning of [...fromFields, ...fromPlanner]) {
    const key = `${warning.code}::${warning.taskId}::${warning.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(warning);
  }
  return result;
}

export type DriverStatusWorkType = WorkType;

export function parseDriverWorkType(
  value: string | null | undefined,
): DriverStatusWorkType | null {
  if (value === "delivery" || value === "pickup") return value;
  return null;
}

/** DB row fields needed to validate a Driver App mutation against live plan state. */
export type DriverMutationItemRow = {
  id: string;
  bookingId: string;
  deliveryDate: string | null;
  deliveryTruck: string | null;
  trailerLoad: number | null;
  pickupDate: string | null;
  pickupTruck: string | null;
  pickupTrailerLoad: number | null;
  eventDate: string;
  spanDays: number;
};

export type DriverMutationValidation =
  | { ok: true; workTruck: string | null; workDate: string | null }
  | { ok: false; reason: string };

/**
 * Reject mismatched booking/item identity, wrong work-type truck, and stale
 * operational dates before writing route status or closeout.
 * Driver App always operates in single-date mode for date fallbacks.
 */
export function validateDriverMutationContext(args: {
  bookingId: string;
  itemId: string;
  workType: WorkType;
  item: DriverMutationItemRow;
  submittedTruck?: string | null;
  submittedDate?: string | null;
  requireAssignedTruck?: boolean;
}): DriverMutationValidation {
  if (args.item.id !== args.itemId) {
    return { ok: false, reason: "Rental item mismatch" };
  }
  if (String(args.item.bookingId) !== String(args.bookingId)) {
    return { ok: false, reason: "Booking and rental item do not match" };
  }

  const workTruck =
    args.workType === "delivery" ? args.item.deliveryTruck : args.item.pickupTruck;
  const workDate =
    args.workType === "delivery"
      ? effectiveDeliveryWorkDate({
          deliveryDate: args.item.deliveryDate,
          eventDate: args.item.eventDate,
          singleDateMode: true,
        })
      : effectivePickupWorkDate({
          pickupDate: args.item.pickupDate,
          eventDate: args.item.eventDate,
          spanDays: args.item.spanDays,
        });

  const submittedTruck = args.submittedTruck?.trim() || null;
  const submittedDate = args.submittedDate?.trim() || null;

  if (args.requireAssignedTruck) {
    if (!isDeliveryTruckId(submittedTruck)) {
      return { ok: false, reason: "Truck assignment required" };
    }
    if (!isDeliveryTruckId(workTruck) || workTruck !== submittedTruck) {
      return {
        ok: false,
        reason: "Stop truck assignment changed. Refresh and try again.",
      };
    }
    if (!submittedDate || !workDate || workDate !== submittedDate) {
      return {
        ok: false,
        reason: "Stop work date changed. Refresh and try again.",
      };
    }
  } else if (submittedTruck && submittedTruck !== "unassigned") {
    if (!isDeliveryTruckId(submittedTruck)) {
      return { ok: false, reason: "Invalid truck" };
    }
    if (isDeliveryTruckId(workTruck) && workTruck !== submittedTruck) {
      return {
        ok: false,
        reason: "Stop truck assignment changed. Refresh and try again.",
      };
    }
    if (submittedDate && workDate && workDate !== submittedDate) {
      return {
        ok: false,
        reason: "Stop work date changed. Refresh and try again.",
      };
    }
  }

  return { ok: true, workTruck, workDate };
}

/** Build the item-row patch for a status action. Never mixes work types. */
export function buildDriverStatusItemPatch(args: {
  workType: WorkType;
  status: string;
  notes?: string | null;
  clearNotes?: boolean;
}): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  if (args.workType === "delivery") {
    patch.delivery_route_status = args.status;
    if (args.clearNotes) {
      patch.delivery_route_notes = null;
    } else if (typeof args.notes === "string" && args.notes.trim()) {
      patch.delivery_route_notes = args.notes.trim();
    }
  } else {
    patch.pickup_route_status = args.status;
    if (args.clearNotes) {
      patch.pickup_route_notes = null;
    } else if (typeof args.notes === "string" && args.notes.trim()) {
      patch.pickup_route_notes = args.notes.trim();
    }
  }
  return patch;
}

/** Closeout completion status for the given work type (item-scoped). */
export function buildDriverCloseoutItemPatch(args: {
  workType: WorkType;
}): Record<string, string> {
  if (args.workType === "pickup") {
    return { pickup_route_status: "picked-up" };
  }
  return { delivery_route_status: "setup-complete" };
}

export function onTheWayEmailCopy(args: {
  workType: WorkType;
  customerName: string | null;
  eventDate: string | null;
  eventStartTime: string | null;
  requestedDeliveryWindow: string | null;
  eventAddress: string | null;
}): { subject: string; text: string } {
  const name = args.customerName?.trim() || "there";
  if (args.workType === "pickup") {
    return {
      subject: "Jumping Jax is on the way for pickup",
      text: [
        `Hi ${name},`,
        "",
        "Your Jumping Jax crew is on the way to pick up your rental.",
        "",
        args.eventDate ? `Event date: ${args.eventDate}` : null,
        args.eventStartTime ? `Party start time: ${args.eventStartTime}` : null,
        args.eventAddress ? `Pickup address: ${args.eventAddress}` : null,
        "",
        "Please make sure the inflatable is deflated and ready when we arrive, if you were asked to do so.",
        "Thank you for booking with Jumping Jax.",
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    };
  }
  return {
    subject: "Jumping Jax is on the way",
    text: [
      `Hi ${name},`,
      "",
      "Your Jumping Jax delivery crew is on the way.",
      "",
      args.eventDate ? `Event date: ${args.eventDate}` : null,
      args.eventStartTime ? `Party start time: ${args.eventStartTime}` : null,
      args.requestedDeliveryWindow
        ? `Requested delivery window: ${args.requestedDeliveryWindow}`
        : null,
      args.eventAddress ? `Delivery address: ${args.eventAddress}` : null,
      "",
      "Please make sure the setup area is clear and accessible.",
      "Thank you for booking with Jumping Jax.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  };
}

export function taskToPrintStop(task: AdminDeliveryWorkTask): DriverPrintStop | null {
  if (!task.workDate || !isDeliveryTruckId(task.truck)) return null;
  return {
    id: task.id,
    taskId: task.id,
    bookingId: task.bookingId,
    workType: task.workType,
    deliveryDate: task.workDate,
    deliveryTruck: task.truck,
    trailerLoad: task.trailerLoad,
    deliverySequence: task.sequence,
    rentalName: task.rentalName,
    customerName: task.customerName,
    customerPhone: task.customerPhone,
    eventAddress: task.eventAddress,
    plannedArrivalTime: task.plannedArrivalTime,
    eventStartTime: task.eventStartTime,
    requestedDeliveryWindow: task.requestedDeliveryWindow,
    setupLocation: task.setupLocation,
    setupSurface: task.setupSurface,
    setupAccess: task.setupAccess,
    setupNotes: task.setupNotes,
    routeNotes: task.routeNotes,
    routeStatus: task.routeStatus,
    paymentMethod: task.paymentMethod,
    total: task.total,
    paymentConfirmationNotes: task.paymentConfirmationNotes,
  };
}

export function buildDriverPrintSheets(args: {
  date: string;
  tasks: AdminDeliveryWorkTask[];
  truckFilter?: DriverTruckFilter | null;
}): DriverPrintSheet[] {
  const printable = args.tasks
    .map(taskToPrintStop)
    .filter((stop): stop is DriverPrintStop => stop !== null)
    .filter((stop) => {
      if (!args.truckFilter || args.truckFilter === "unassigned") return true;
      return stop.deliveryTruck === args.truckFilter;
    });

  const days = buildPrintDayGroups({
    dates: [args.date],
    items: printable,
  });

  const sheets: DriverPrintSheet[] = [];
  for (const day of days) {
    for (const sheet of day.sheets) {
      const byLoad = new Map<number, DriverPrintStop[]>();
      for (const stop of sheet.items) {
        const load = stop.trailerLoad ?? 1;
        byLoad.set(load, [...(byLoad.get(load) ?? []), stop]);
      }
      const loadBuckets = [...byLoad.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, stops]) =>
          [...stops].sort((a, b) => {
            const seq = (a.deliverySequence ?? 999) - (b.deliverySequence ?? 999);
            if (seq !== 0) return seq;
            return a.rentalName.localeCompare(b.rentalName);
          }),
        );
      for (const stops of filterNonEmptyPrintLoads(loadBuckets)) {
        const load = stops[0]?.trailerLoad ?? 1;
        sheets.push({
          sheetId: `driver-sheet-${sheet.workType}-${sheet.truck}-load-${load}`,
          date: day.date,
          workType: sheet.workType,
          workTypeLabel: printStopWorkLabel(sheet.workType),
          truck: sheet.truck,
          truckLabel: truckLabel(sheet.truck),
          load,
          stops,
        });
      }
    }
  }
  return sheets;
}

export function buildDriverPrintAssignments(sheets: DriverPrintSheet[]) {
  return sheets.map((sheet) => ({
    sheetId: sheet.sheetId,
    truck: sheet.truck,
    truckLabel: sheet.truckLabel,
    workType: sheet.workType,
    workTypeLabel: printStopWorkLabel(sheet.workType),
    load: sheet.load,
    stopCount: sheet.stops.length,
  }));
}

export function allowedStatusForWorkType(
  workType: WorkType,
  status: string,
): boolean {
  if (workType === "delivery") {
    return ["planned", "on-the-way", "delivered", "setup-complete"].includes(status);
  }
  return ["planned", "on-the-way", "picked-up"].includes(status);
}

export function shouldSendOnTheWayNotification(args: {
  requestedStatus: string;
  currentStatus: string | null;
}): boolean {
  return args.requestedStatus === "on-the-way" && args.currentStatus !== "on-the-way";
}

export function driverViewHasWork(
  dateTasks: AdminDeliveryWorkTask[],
  unassigned: AdminDeliveryWorkTask[],
): boolean {
  return dateTasks.length > 0 || unassigned.length > 0;
}

export function countTasksByTruck(
  dateTasks: AdminDeliveryWorkTask[],
): Record<DeliveryTruckId | "unassigned", number> {
  const counts = {
    "truck-1": 0,
    "truck-2": 0,
    unassigned: 0,
  };
  for (const task of dateTasks) {
    if (isDeliveryTruckId(task.truck)) counts[task.truck] += 1;
    else counts.unassigned += 1;
  }
  return counts;
}

export function isKnownDeliveryTruck(id: string): id is DeliveryTruckId {
  return (DELIVERY_TRUCKS as readonly string[]).includes(id);
}

type DriverEventsSignatureInput = {
  date: string;
  tasks: Array<{
    id: string;
    itemId: string;
    workType: WorkType;
    workDate: string | null;
    truck: string | null;
    trailerLoad: number | null;
    sequence: number | null;
    status: string | null;
    arrival: string | null;
    notes: string | null;
  }>;
  unscheduled: Array<{
    id: string;
    workType: WorkType;
    workDate: string | null;
    truck: string | null;
  }>;
  bookings: Array<{
    id: string;
    paymentConfirmedAt: string | null;
    paymentConfirmedBy: string | null;
  }>;
  closeouts: Array<{
    id: string;
    bookingId: string;
    truck: string;
    updatedAt: string;
    damageIssue: boolean;
    missingItemIssue: boolean;
    customerIssue: boolean;
    siteAccessIssue: boolean;
    latePickupIssue: boolean;
    officeFollowupNeeded: boolean;
    outOfSlideSpray: boolean;
    cashPayment: boolean;
    creditPayment: boolean;
    paid: boolean;
    unpaid: boolean;
    boughtGas: boolean;
    boughtDrinks: boolean;
    customerHappy: boolean;
    notes: string | null;
  }>;
};

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id.localeCompare(b.id);
}

/** Stable SSE invalidation signature — sorted, no customer PII in the payload. */
export function buildDriverEventsSignature(input: DriverEventsSignatureInput): string {
  return JSON.stringify({
    date: input.date,
    tasks: [...input.tasks].sort(byId),
    unscheduled: [...input.unscheduled].sort(byId),
    bookings: [...input.bookings].sort(byId),
    closeouts: [...input.closeouts].sort(byId),
  });
}
