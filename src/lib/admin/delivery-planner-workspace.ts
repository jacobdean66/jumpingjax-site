import type {
  AdminDeliveriesResult,
  AdminDeliveryWorkTask,
} from "./deliveries";
import {
  effectiveDeliveryWorkDate,
  effectivePickupWorkDate,
  isYmd,
  type WorkType,
} from "./delivery-planner-dates";

export type PlannerTruck = "truck-1" | "truck-2";
export type PlannerColumn = "unassigned" | PlannerTruck;

export type PlannerSelection = {
  date: string;
  workType: WorkType;
  truck: PlannerTruck;
};

export type WorkspaceStop = {
  id: string;
  taskIds: string[];
  tasks: AdminDeliveryWorkTask[];
  bookingId: string;
  workType: WorkType;
  workDate: string | null;
  /** Display/filter date: explicit workDate, else established fallback. */
  effectiveWorkDate: string;
  truck: PlannerTruck | null;
  trailerLoad: number | null;
  sequence: number | null;
  products: string[];
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  bookingStatus: string;
  eventDate: string;
  eventAddress: string | null;
  /** Compact location label for planner cards; never falls back to county. */
  city: string;
  /** Retained for routing/reporting; not the primary card label. */
  county: string;
  requestedTime: string | null;
  routeStatus: string | null;
  routeNotes: string | null;
  customerNotes: string | null;
  conflictMessages: string[];
};

export type LibraryWorkCounts = {
  total: number;
  unassigned: number;
  "truck-1": number;
  "truck-2": number;
};

export type LibraryDateEntry = {
  date: string;
  total: number;
  delivery: LibraryWorkCounts;
  pickup: LibraryWorkCounts;
};

export type RouteAssignmentPayload =
  | {
      itemId: string;
      bookingId: string;
      workType: "delivery";
      deliveryDate: string | null;
      deliveryTruck: PlannerTruck | null;
      trailerLoad: number | null;
      deliverySequence: number | null;
      plannedArrivalTime: string | null;
      plannedSetupStart: string | null;
      plannedSetupEnd: string | null;
      estimatedSetupMinutes: number;
      deliveryRouteStatus: string | null;
      deliveryRouteNotes: string | null;
    }
  | {
      itemId: string;
      bookingId: string;
      workType: "pickup";
      pickupDate: string | null;
      pickupTime: string | null;
      pickupTruck: PlannerTruck | null;
      pickupTrailerLoad: number | null;
      pickupSequence: number | null;
      pickupRouteStatus: string | null;
      pickupRouteNotes: string | null;
    };

function asTruck(value: string | null): PlannerTruck | null {
  return value === "truck-1" || value === "truck-2" ? value : null;
}

/**
 * Single source of truth for planner date matching.
 * Explicit operational workDate always wins. When absent:
 * - delivery falls back to eventDate (same semantics as single-date mode)
 * - pickup falls back to derived pickup date from eventDate + spanDays
 * Does not mutate the task or invent a database write.
 */
export function effectivePlannerWorkDate(
  task: Pick<
    AdminDeliveryWorkTask,
    "workDate" | "workType" | "eventDate" | "spanDays"
  >,
): string {
  if (isYmd(task.workDate)) return task.workDate;
  if (task.workType === "pickup") {
    return effectivePickupWorkDate({
      pickupDate: null,
      eventDate: task.eventDate,
      spanDays: task.spanDays,
    });
  }
  return (
    effectiveDeliveryWorkDate({
      deliveryDate: null,
      eventDate: task.eventDate,
      singleDateMode: true,
    }) ?? task.eventDate.slice(0, 10)
  );
}

export function taskMatchesColumn(
  task: AdminDeliveryWorkTask,
  date: string,
  workType: WorkType,
  column: PlannerColumn,
): boolean {
  return (
    effectivePlannerWorkDate(task) === date &&
    task.workType === workType &&
    (column === "unassigned" ? asTruck(task.truck) === null : asTruck(task.truck) === column)
  );
}

export function stopMatchesColumn(
  stop: WorkspaceStop,
  date: string,
  workType: WorkType,
  column: PlannerColumn,
): boolean {
  return (
    stop.effectiveWorkDate === date &&
    stop.workType === workType &&
    (column === "unassigned" ? stop.truck === null : stop.truck === column)
  );
}

function conciseProductName(task: AdminDeliveryWorkTask): string {
  return task.rentalName.trim() || task.rentalItem.trim() || "Rental item";
}

export function productSummary(products: string[]): string {
  const unique = [...new Set(products.map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) return "Rental item";
  if (unique.length <= 2) return unique.join(" · ");
  return `${unique.slice(0, 2).join(" · ")} +${unique.length - 2} more`;
}

export function countyFromAddress(address: string | null): string {
  if (!address) return "County unavailable";
  const match = address.match(/(?:^|,\s*|\b)([A-Za-z][A-Za-z .'-]*?)\s+County(?:,|$)/i);
  if (!match?.[1]) return "County unavailable";
  const name = match[1].trim().replace(/\s+/g, " ");
  return name ? `${name} County` : "County unavailable";
}

export const CITY_UNAVAILABLE = "City unavailable";

const ZIP_ONLY = /^\d{5}(?:-\d{4})?$/;
const STATE_OR_STATE_ZIP = /^[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/i;
const COUNTY_LABEL = /\bCounty\b/i;
const UNIT_OR_SECONDARY =
  /^(?:apt|apartment|suite|ste|unit|bldg|building|fl|floor|rm|room|#)\b/i;
/** Full US state / DC names so they are never shown as city labels. */
const US_STATE_NAMES = new Set([
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "district of columbia",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
]);

/** Title-case city names without destroying mixed-case forms like McBee. */
export function normalizeCityDisplay(city: string): string {
  const cleaned = city.replace(/\s+/g, " ").trim();
  if (!cleaned) return CITY_UNAVAILABLE;
  const hasInternalUpper = /[A-Z]/.test(cleaned.slice(1));
  const hasLower = /[a-z]/.test(cleaned);
  if (hasInternalUpper && hasLower) return cleaned;
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, boundary: string, letter: string) => {
      return `${boundary}${letter.toUpperCase()}`;
    });
}

function looksLikeCountyPart(part: string): boolean {
  return COUNTY_LABEL.test(part.trim());
}

function looksLikeStateOrZipPart(part: string): boolean {
  const trimmed = part.trim();
  if (!trimmed) return false;
  if (ZIP_ONLY.test(trimmed) || STATE_OR_STATE_ZIP.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  if (US_STATE_NAMES.has(lower)) return true;
  const withZip = lower.match(/^(.+?)\s+(\d{5}(?:-\d{4})?)$/);
  return Boolean(withZip && US_STATE_NAMES.has(withZip[1]!));
}

function looksLikeUnitOrSecondaryPart(part: string): boolean {
  return UNIT_OR_SECONDARY.test(part.trim());
}

/** Parts that must never be shown as a Route Planner city label. */
function looksLikeNonCityPart(part: string): boolean {
  const trimmed = part.trim();
  if (!trimmed) return true;
  return (
    looksLikeCountyPart(trimmed) ||
    looksLikeStateOrZipPart(trimmed) ||
    looksLikeUnitOrSecondaryPart(trimmed)
  );
}

/**
 * Derive a display city from a structured city field or a US-style address.
 * Never substitutes county when city cannot be determined.
 */
export function cityFromAddress(
  address: string | null | undefined,
  structuredCity?: string | null,
): string {
  const structured = structuredCity?.replace(/\s+/g, " ").trim();
  if (structured && !looksLikeNonCityPart(structured)) {
    return normalizeCityDisplay(structured);
  }

  if (!address?.trim()) return CITY_UNAVAILABLE;

  const parts = address
    .split(",")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length === 0) return CITY_UNAVAILABLE;

  let stateIndex = -1;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (looksLikeStateOrZipPart(parts[i]!)) {
      stateIndex = i;
      break;
    }
  }

  let cityIndex =
    stateIndex > 0 ? stateIndex - 1 : parts.length >= 2 ? parts.length - 2 : -1;
  while (cityIndex >= 0 && looksLikeNonCityPart(parts[cityIndex]!)) {
    cityIndex -= 1;
  }

  const cityCandidate = cityIndex >= 0 ? parts[cityIndex]! : null;

  if (!cityCandidate || looksLikeNonCityPart(cityCandidate)) {
    return CITY_UNAVAILABLE;
  }

  // Reject street-like leftovers (leading house number).
  if (/^\d+\s/.test(cityCandidate)) {
    return CITY_UNAVAILABLE;
  }

  return normalizeCityDisplay(cityCandidate);
}

function stopGroupKey(task: AdminDeliveryWorkTask): string {
  return [
    task.bookingId,
    task.workType,
    effectivePlannerWorkDate(task),
    asTruck(task.truck) ?? "unassigned",
    task.trailerLoad ?? "none",
  ].join(":");
}

export function groupOperationalStops(
  tasks: AdminDeliveryWorkTask[],
): WorkspaceStop[] {
  const grouped = new Map<string, AdminDeliveryWorkTask[]>();
  for (const task of tasks) {
    const key = stopGroupKey(task);
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }

  return [...grouped.entries()]
    .map(([id, groupedTasks]) => {
      const orderedTasks = [...groupedTasks].sort((a, b) => a.id.localeCompare(b.id));
      const first = orderedTasks[0]!;
      const sequences = orderedTasks
        .map((task) => task.sequence)
        .filter((value): value is number => typeof value === "number");
      return {
        id,
        taskIds: orderedTasks.map((task) => task.id),
        tasks: orderedTasks,
        bookingId: first.bookingId,
        workType: first.workType,
        workDate: first.workDate,
        effectiveWorkDate: effectivePlannerWorkDate(first),
        truck: asTruck(first.truck),
        trailerLoad: first.trailerLoad,
        sequence: sequences.length > 0 ? Math.min(...sequences) : null,
        products: [...new Set(orderedTasks.map(conciseProductName))],
        customerName: first.customerName,
        customerEmail: first.customerEmail,
        customerPhone: first.customerPhone,
        bookingStatus: first.bookingStatus,
        eventDate: first.eventDate,
        eventAddress: first.eventAddress,
        city: cityFromAddress(first.eventAddress),
        county: countyFromAddress(first.eventAddress),
        requestedTime:
          first.workType === "pickup"
            ? first.workTime
            : first.requestedDeliveryWindow ?? first.workTime,
        routeStatus: first.routeStatus,
        routeNotes: first.routeNotes,
        customerNotes: first.setupNotes,
        conflictMessages: [
          ...new Set(orderedTasks.flatMap((task) => task.warnings.map((warning) => warning.message))),
        ],
      };
    })
    .sort(
      (a, b) =>
        (a.sequence ?? Number.MAX_SAFE_INTEGER) -
          (b.sequence ?? Number.MAX_SAFE_INTEGER) ||
        a.customerName.localeCompare(b.customerName) ||
        a.id.localeCompare(b.id),
    );
}

function emptyWorkCounts(): LibraryWorkCounts {
  return { total: 0, unassigned: 0, "truck-1": 0, "truck-2": 0 };
}

export function buildLoadLibrary(
  tasks: AdminDeliveryWorkTask[],
  dates: string[],
): LibraryDateEntry[] {
  const stops = groupOperationalStops(tasks);
  return dates.map((date) => {
    const entry: LibraryDateEntry = {
      date,
      total: 0,
      delivery: emptyWorkCounts(),
      pickup: emptyWorkCounts(),
    };
    for (const stop of stops) {
      if (stop.effectiveWorkDate !== date) continue;
      const counts = entry[stop.workType];
      counts.total += 1;
      counts[stop.truck ?? "unassigned"] += 1;
      entry.total += 1;
    }
    return entry;
  });
}

export function selectionKey(selection: PlannerSelection): string {
  return `${selection.date}:${selection.workType}:${selection.truck}`;
}

export function taskMatchesSelection(
  task: AdminDeliveryWorkTask,
  selection: PlannerSelection,
): boolean {
  return taskMatchesColumn(
    task,
    selection.date,
    selection.workType,
    selection.truck,
  );
}

function taskRouteState(task: AdminDeliveryWorkTask): string {
  return JSON.stringify({
    workDate: task.workDate,
    workType: task.workType,
    truck: asTruck(task.truck),
    trailerLoad: task.trailerLoad,
    sequence: task.sequence,
    plannedArrivalTime: task.plannedArrivalTime,
    plannedSetupStart: task.plannedSetupStart,
    plannedSetupEnd: task.plannedSetupEnd,
    routeStatus: task.routeStatus,
    routeNotes: task.routeNotes,
  });
}

export function changedTaskIds(
  baseline: AdminDeliveryWorkTask[],
  current: AdminDeliveryWorkTask[],
): Set<string> {
  const baselineById = new Map(baseline.map((task) => [task.id, task]));
  return new Set(
    current
      .filter((task) => {
        const before = baselineById.get(task.id);
        return !before || taskRouteState(before) !== taskRouteState(task);
      })
      .map((task) => task.id),
  );
}

export function dirtySelectionKeys(
  baseline: AdminDeliveryWorkTask[],
  current: AdminDeliveryWorkTask[],
): Set<string> {
  const currentById = new Map(current.map((task) => [task.id, task]));
  const dirty = new Set<string>();
  for (const taskId of changedTaskIds(baseline, current)) {
    const before = baseline.find((task) => task.id === taskId);
    const after = currentById.get(taskId);
    for (const task of [before, after]) {
      const truck = task ? asTruck(task.truck) : null;
      if (task && truck) {
        dirty.add(
          selectionKey({
            date: effectivePlannerWorkDate(task),
            workType: task.workType,
            truck,
          }),
        );
      }
    }
  }
  return dirty;
}

function sequenceStops(
  tasks: AdminDeliveryWorkTask[],
  date: string,
  workType: WorkType,
  truck: PlannerTruck,
  movingTaskIds: Set<string>,
  targetIndex: number,
): Map<string, number> {
  const stops = groupOperationalStops(
    tasks.filter(
      (task) =>
        taskMatchesColumn(task, date, workType, truck) &&
        !movingTaskIds.has(task.id),
    ),
  );
  const movingTasks = tasks.filter((task) => movingTaskIds.has(task.id));
  if (movingTasks.length > 0) {
    const movingStop = groupOperationalStops(movingTasks)[0]!;
    stops.splice(Math.max(0, Math.min(targetIndex, stops.length)), 0, movingStop);
  }
  const sequenceByTask = new Map<string, number>();
  stops.forEach((stop, index) => {
    stop.taskIds.forEach((taskId) => sequenceByTask.set(taskId, index + 1));
  });
  return sequenceByTask;
}

export function moveStop(
  tasks: AdminDeliveryWorkTask[],
  taskIds: string[],
  options: {
    date: string;
    workType: WorkType;
    target: PlannerColumn;
    targetIndex: number;
  },
): { tasks: AdminDeliveryWorkTask[]; conflict: string | null } {
  const movingIds = new Set(taskIds);
  if (movingIds.size !== taskIds.length) {
    return { tasks, conflict: "Duplicate operational task in drag selection." };
  }
  const moving = tasks.filter((task) => movingIds.has(task.id));
  if (
    moving.length !== taskIds.length ||
    moving.some(
      (task) =>
        task.workType !== options.workType ||
        effectivePlannerWorkDate(task) !== options.date,
    )
  ) {
    return { tasks, conflict: "This work task does not belong to the selected load." };
  }

  const targetTruck = options.target === "unassigned" ? null : options.target;
  let next = tasks.map((task) => {
    if (!movingIds.has(task.id)) return task;
    const alreadyAssigned = asTruck(task.truck) !== null;
    return {
      ...task,
      // Newly assigning from unassigned sets an explicit operational date.
      // Already-assigned null workDate stays null so viewing/reordering alone
      // does not invent a deliveryDate/pickupDate write.
      workDate: targetTruck
        ? task.workDate ?? (alreadyAssigned ? task.workDate : options.date)
        : task.workDate,
      truck: targetTruck,
      trailerLoad: targetTruck ? task.trailerLoad ?? 1 : null,
      sequence: null,
      routeStatus: targetTruck ? "draft" : "unplanned",
    };
  });

  for (const truck of ["truck-1", "truck-2"] as const) {
    const sequenceByTask = sequenceStops(
      next,
      options.date,
      options.workType,
      truck,
      targetTruck === truck ? movingIds : new Set<string>(),
      targetTruck === truck ? options.targetIndex : Number.MAX_SAFE_INTEGER,
    );
    next = next.map((task) =>
      taskMatchesColumn(task, options.date, options.workType, truck)
        ? {
            ...task,
            sequence: sequenceByTask.get(task.id) ?? task.sequence,
            routeStatus: movingIds.has(task.id) ? "draft" : task.routeStatus,
          }
        : task,
    );
  }
  return { tasks: next, conflict: null };
}

export function assignmentForTask(
  task: AdminDeliveryWorkTask,
): RouteAssignmentPayload {
  const truck = asTruck(task.truck);
  if (task.workType === "pickup") {
    return {
      itemId: task.itemId,
      bookingId: task.bookingId,
      workType: "pickup",
      pickupDate: task.workDate,
      pickupTime: task.plannedArrivalTime ?? task.workTime,
      pickupTruck: truck,
      pickupTrailerLoad: task.trailerLoad,
      pickupSequence: task.sequence,
      pickupRouteStatus: task.routeStatus,
      pickupRouteNotes: task.routeNotes,
    };
  }
  return {
    itemId: task.itemId,
    bookingId: task.bookingId,
    workType: "delivery",
    deliveryDate: task.workDate,
    deliveryTruck: truck,
    trailerLoad: task.trailerLoad,
    deliverySequence: task.sequence,
    plannedArrivalTime: task.plannedArrivalTime,
    plannedSetupStart: task.plannedSetupStart,
    plannedSetupEnd: task.plannedSetupEnd,
    estimatedSetupMinutes: task.estimatedSetupMinutes,
    deliveryRouteStatus: task.routeStatus,
    deliveryRouteNotes: task.routeNotes,
  };
}

export function assignmentsForSelection(
  baseline: AdminDeliveryWorkTask[],
  current: AdminDeliveryWorkTask[],
  selection: PlannerSelection,
): RouteAssignmentPayload[] {
  const changed = changedTaskIds(baseline, current);
  const beforeById = new Map(baseline.map((task) => [task.id, task]));
  return current
    .filter((task) => {
      if (!changed.has(task.id)) return false;
      return (
        taskMatchesSelection(task, selection) ||
        Boolean(beforeById.get(task.id) && taskMatchesSelection(beforeById.get(task.id)!, selection))
      );
    })
    .map(assignmentForTask);
}

export function allPlannerTasks(deliveries: AdminDeliveriesResult): AdminDeliveryWorkTask[] {
  const byId = new Map<string, AdminDeliveryWorkTask>();
  for (const task of [...deliveries.tasks, ...deliveries.unscheduled]) {
    if (!byId.has(task.id)) byId.set(task.id, task);
  }
  return [...byId.values()];
}

export function taskSearchText(task: AdminDeliveryWorkTask): string {
  return [
    task.customerName,
    task.rentalName,
    task.rentalItem,
    task.eventAddress,
    cityFromAddress(task.eventAddress),
    countyFromAddress(task.eventAddress),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function rangeDates(anchor: string, length = 7): string[] {
  const [year, month, day] = anchor.split("-").map(Number);
  const result: string[] = [];
  for (let offset = 0; offset < length; offset += 1) {
    const date = new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + offset);
    result.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    );
  }
  return result;
}
