export type WorkType = "delivery" | "pickup";

export type PlannerWorkFilter =
  | "all"
  | "deliveries"
  | "pickups"
  | "unscheduled";

export type DatePresetId =
  | "today"
  | "tomorrow"
  | "this-weekend"
  | "next-weekend"
  | "clear";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Operational “today” for admin/driver planning (not server-local or UTC). */
export const ADMIN_OPERATIONS_TIME_ZONE = "America/New_York";

export function isYmd(value: string | null | undefined): value is string {
  if (!value || !YMD_RE.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }
  // Civil calendar check via UTC components — no local timezone day shift.
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Calendar YYYY-MM-DD in America/New_York for the given instant. */
export function todayYmd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ADMIN_OPERATIONS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/** Format a Date’s local Y/M/D components (for civil arithmetic from YMD parts). */
export function dateToYmd(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return dateToYmd(date);
}

export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Sort ascending and dedupe valid YYYY-MM-DD values. */
export function normalizeSelectedDates(
  values: Array<string | null | undefined>,
  fallbackToday = todayYmd(),
): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (isYmd(value)) set.add(value);
  }
  const sorted = [...set].sort(compareYmd);
  return sorted.length > 0 ? sorted : [normalizeDeliveryDate(fallbackToday)];
}

export function normalizeDeliveryDate(value: string | null | undefined): string {
  if (isYmd(value)) return value;
  return todayYmd();
}

/**
 * Parse URL search params for planning dates.
 * `dates` wins when present; otherwise wrap single `date` (or today).
 */
export function parseDatesFromSearchParams(params: {
  date?: string | null;
  dates?: string | null;
}): string[] {
  if (params.dates != null && params.dates.trim() !== "") {
    const parts = params.dates.split(/[,\s]+/).map((part) => part.trim());
    return normalizeSelectedDates(parts);
  }
  return normalizeSelectedDates([params.date]);
}

export function datesToSearchParams(
  dates: string[],
  extra?: Record<string, string | undefined | null>,
): URLSearchParams {
  const normalized = normalizeSelectedDates(dates);
  const params = new URLSearchParams();
  if (normalized.length === 1) {
    params.set("date", normalized[0]!);
  } else {
    params.set("dates", normalized.join(","));
    params.set("date", normalized[0]!);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value != null && value !== "" && value !== "all") {
        params.set(key, value);
      }
    }
  }
  return params;
}

/** Saturday + Sunday for the weekend containing `anchor` (or next if Mon–Fri). */
export function weekendContaining(anchorYmd: string): [string, string] {
  const [year, month, day] = anchorYmd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const dow = date.getDay(); // 0 Sun … 6 Sat
  const toSaturday =
    dow === 0 ? -1 : dow === 6 ? 0 : 6 - dow;
  const saturday = addDays(anchorYmd, toSaturday);
  return [saturday, addDays(saturday, 1)];
}

export function nextWeekend(anchorYmd: string): [string, string] {
  const [thisSat] = weekendContaining(anchorYmd);
  const [year, month, day] = anchorYmd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const dow = date.getDay();
  // If already on this weekend (Sat/Sun), jump forward a full week from this Saturday.
  if (dow === 0 || dow === 6) {
    const nextSat = addDays(thisSat, 7);
    return [nextSat, addDays(nextSat, 1)];
  }
  // Mon–Fri: "next weekend" means the coming weekend after this week's.
  const nextSat = addDays(thisSat, 7);
  return [nextSat, addDays(nextSat, 1)];
}

/**
 * Canonical Route Planner planning window when no explicit dates are chosen:
 * today (America/New_York) plus the next six calendar days.
 */
export function defaultPlanningWindowDates(now = new Date()): string[] {
  const today = todayYmd(now);
  return Array.from({ length: 7 }, (_, offset) => addDays(today, offset));
}

export function datesForPreset(
  preset: DatePresetId,
  now = new Date(),
): string[] {
  const today = todayYmd(now);
  switch (preset) {
    case "today":
      return [today];
    case "tomorrow":
      return [addDays(today, 1)];
    case "this-weekend":
      return [...weekendContaining(today)];
    case "next-weekend":
      return [...nextWeekend(today)];
    case "clear":
      return defaultPlanningWindowDates(now);
    default:
      return [today];
  }
}

/** Sort and dedupe valid YMD values without injecting a today fallback. */
export function sortUniqueYmd(
  values: Array<string | null | undefined>,
): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (isYmd(value)) set.add(value);
  }
  return [...set].sort(compareYmd);
}

export function toggleDateInSelection(
  selected: string[],
  date: string,
): string[] {
  if (!isYmd(date)) return normalizeSelectedDates(selected);
  const set = new Set(normalizeSelectedDates(selected));
  if (set.has(date)) {
    set.delete(date);
  } else {
    set.add(date);
  }
  return normalizeSelectedDates([...set]);
}

/**
 * Toggle a date in a draft multi-select. Empty drafts are allowed
 * (unlike normalizeSelectedDates, which falls back to today).
 */
export function toggleDateInDraft(
  selected: string[],
  date: string,
): string[] {
  if (!isYmd(date)) return sortUniqueYmd(selected);
  const set = new Set(sortUniqueYmd(selected));
  if (set.has(date)) {
    set.delete(date);
  } else {
    set.add(date);
  }
  return sortUniqueYmd([...set]);
}

export function removeDateFromDraft(
  selected: string[],
  date: string,
): string[] {
  return sortUniqueYmd(selected.filter((value) => value !== date));
}

export function addDateRangeToSelection(
  selected: string[],
  start: string,
  end: string,
): string[] {
  if (!isYmd(start) || !isYmd(end)) return normalizeSelectedDates(selected);
  const [from, to] = compareYmd(start, end) <= 0 ? [start, end] : [end, start];
  const next = new Set(normalizeSelectedDates(selected));
  let cursor = from;
  while (compareYmd(cursor, to) <= 0) {
    next.add(cursor);
    cursor = addDays(cursor, 1);
  }
  return normalizeSelectedDates([...next]);
}

export function removeDateFromSelection(
  selected: string[],
  date: string,
): string[] {
  return normalizeSelectedDates(selected.filter((value) => value !== date));
}

export function derivedPickupDate(eventDate: string, spanDays: number): string {
  const span = Number.isFinite(spanDays) && spanDays >= 1 ? Math.floor(spanDays) : 1;
  return addDays(eventDate.slice(0, 10), Math.max(0, span - 1));
}

/**
 * Single-date boards keep legacy fallback to event_date.
 * Multi-date boards treat null delivery_date as unscheduled.
 */
export function effectiveDeliveryWorkDate(args: {
  deliveryDate: string | null | undefined;
  eventDate: string;
  singleDateMode: boolean;
}): string | null {
  if (isYmd(args.deliveryDate)) return args.deliveryDate;
  if (args.singleDateMode) return args.eventDate.slice(0, 10);
  return null;
}

export function effectivePickupWorkDate(args: {
  pickupDate: string | null | undefined;
  eventDate: string;
  spanDays: number;
}): string {
  if (isYmd(args.pickupDate)) return args.pickupDate;
  return derivedPickupDate(args.eventDate, args.spanDays);
}

export function workTaskId(itemId: string, workType: WorkType): string {
  return `${itemId}:${workType}`;
}

export function formatLongDate(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCompactDate(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Compact month/day label without weekday (e.g. "Jul 17"). */
export function formatMonthDay(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Human summary for the date-selector control.
 * 0 -> prompt, 1 -> long date, 2-3 -> "Jul 17, Jul 19", else count.
 */
export function summarizeSelectedDates(selected: string[]): string {
  const dates = sortUniqueYmd(selected);
  if (dates.length === 0) return "Select route dates";
  if (dates.length === 1) return formatLongDate(dates[0]!);
  if (dates.length <= 3) return dates.map(formatMonthDay).join(", ");
  return `${dates.length} dates selected`;
}

export function monthMatrix(
  year: number,
  monthIndex: number,
): Array<Array<number | null>> {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function formatShortWeekday(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function crossDateBanner(args: {
  workType: WorkType;
  workDate: string | null;
  eventDate: string;
}): string | null {
  if (!args.workDate || args.workDate === args.eventDate.slice(0, 10)) {
    return null;
  }
  const workDay = formatShortWeekday(args.workDate);
  const eventDay = formatShortWeekday(args.eventDate.slice(0, 10));
  if (args.workType === "delivery") {
    return `${workDay} setup for ${eventDay} event`;
  }
  return `${workDay} pickup for ${eventDay} event`;
}

export type PlannerConflictWarning = {
  code:
    | "setup_after_event"
    | "pickup_before_event"
    | "pickup_before_delivery"
    | "impossible_order"
    | "outside_window"
    | "duplicate_task"
    | "resource_overlap"
    | "pickup_before_span_end";
  message: string;
  taskId?: string;
};

export function evaluateWorkDateConflicts(args: {
  taskId: string;
  workType: WorkType;
  workDate: string | null;
  eventDate: string;
  spanDays: number;
  deliveryDate: string | null;
  pickupDate: string | null;
  selectedDates: string[];
}): PlannerConflictWarning[] {
  const warnings: PlannerConflictWarning[] = [];
  const event = args.eventDate.slice(0, 10);
  const selected = new Set(args.selectedDates);
  const delivery =
    args.deliveryDate ??
    (args.workType === "delivery" ? args.workDate : null);
  const pickup =
    args.pickupDate ??
    (args.workType === "pickup" ? args.workDate : null) ??
    derivedPickupDate(event, args.spanDays);

  if (args.workDate && !selected.has(args.workDate)) {
    warnings.push({
      code: "outside_window",
      taskId: args.taskId,
      message: "Work date is outside the selected planning window.",
    });
  }

  if (args.workType === "delivery" && args.workDate && compareYmd(args.workDate, event) > 0) {
    warnings.push({
      code: "setup_after_event",
      taskId: args.taskId,
      message: "Setup/delivery date is after the event date.",
    });
  }

  if (args.workType === "pickup" && args.workDate && compareYmd(args.workDate, event) < 0) {
    warnings.push({
      code: "pickup_before_event",
      taskId: args.taskId,
      message: "Pickup date is before the event date.",
    });
  }

  if (delivery && pickup && compareYmd(pickup, delivery) < 0) {
    warnings.push({
      code: "impossible_order",
      taskId: args.taskId,
      message: "Pickup is scheduled before delivery/setup.",
    });
  }

  if (delivery && pickup && compareYmd(pickup, event) < 0) {
    warnings.push({
      code: "pickup_before_delivery",
      taskId: args.taskId,
      message: "Pickup is before the event ends.",
    });
  }

  const spanEnd = derivedPickupDate(event, args.spanDays);
  if (
    args.workType === "pickup" &&
    args.workDate &&
    args.spanDays > 1 &&
    compareYmd(args.workDate, spanEnd) < 0
  ) {
    warnings.push({
      code: "pickup_before_span_end",
      taskId: args.taskId,
      message: "Pickup is scheduled before the rental span ends.",
    });
  }

  return warnings;
}

export function findDuplicateTaskIds(taskIds: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of taskIds) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

function minutesFromTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export type OverlapTask = {
  taskId: string;
  workDate: string;
  truck: string | null;
  startTime: string | null;
  endTime: string | null;
};

/** Same truck overlapping time windows on the same work date. */
export function findResourceOverlaps(tasks: OverlapTask[]): PlannerConflictWarning[] {
  const warnings: PlannerConflictWarning[] = [];
  const byKey = new Map<string, OverlapTask[]>();

  for (const task of tasks) {
    if (!task.truck || !task.workDate) continue;
    const key = `${task.workDate}:${task.truck}`;
    const list = byKey.get(key) ?? [];
    list.push(task);
    byKey.set(key, list);
  }

  for (const group of byKey.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]!;
        const b = group[j]!;
        const aStart = minutesFromTime(a.startTime);
        const aEnd = minutesFromTime(a.endTime);
        const bStart = minutesFromTime(b.startTime);
        const bEnd = minutesFromTime(b.endTime);
        if (aStart == null || aEnd == null || bStart == null || bEnd == null) {
          continue;
        }
        if (aStart < bEnd && bStart < aEnd) {
          warnings.push({
            code: "resource_overlap",
            taskId: a.taskId,
            message: `Overlapping work with another stop on the same trailer (${b.taskId}).`,
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * Group work tasks by work date for planner layout.
 * Tasks with null workDate are omitted (belong in Unscheduled).
 */
export function groupTasksByWorkDate<T extends { workDate: string | null }>(
  tasks: T[],
  selectedDates: string[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const date of normalizeSelectedDates(selectedDates)) {
    map.set(date, []);
  }
  for (const task of tasks) {
    if (!task.workDate || !map.has(task.workDate)) continue;
    map.get(task.workDate)!.push(task);
  }
  return map;
}

/**
 * Scenario helper for tests: classify where a booking's delivery/pickup land.
 */
export function classifyBookingWork(args: {
  eventDate: string;
  spanDays: number;
  deliveryDate: string | null;
  pickupDate: string | null;
  selectedDates: string[];
  singleDateMode?: boolean;
}): {
  deliverySection: string | "unscheduled" | null;
  pickupSection: string | "unscheduled" | null;
  deliveryBanner: string | null;
  pickupBanner: string | null;
} {
  const singleDateMode =
    args.singleDateMode ?? normalizeSelectedDates(args.selectedDates).length === 1;
  const selected = new Set(normalizeSelectedDates(args.selectedDates));
  const event = args.eventDate.slice(0, 10);

  const deliveryWork = effectiveDeliveryWorkDate({
    deliveryDate: args.deliveryDate,
    eventDate: event,
    singleDateMode,
  });
  const pickupWork = effectivePickupWorkDate({
    pickupDate: args.pickupDate,
    eventDate: event,
    spanDays: args.spanDays,
  });

  let deliverySection: string | "unscheduled" | null = null;
  if (deliveryWork && selected.has(deliveryWork)) {
    deliverySection = deliveryWork;
  } else if (!deliveryWork && selected.has(event)) {
    deliverySection = "unscheduled";
  } else if (deliveryWork && !selected.has(deliveryWork) && selected.has(event)) {
    deliverySection = "unscheduled";
  }

  let pickupSection: string | "unscheduled" | null = null;
  const pickupExplicit = isYmd(args.pickupDate);
  if (selected.has(pickupWork)) {
    pickupSection = pickupWork;
  }
  if (!pickupExplicit && selected.has(event) && !selected.has(pickupWork)) {
    pickupSection = pickupSection ?? "unscheduled";
  }
  if (!pickupExplicit && selected.has(event) && selected.has(pickupWork)) {
    // Show on derived day; also surface in unscheduled only when not on a selected day.
  }

  return {
    deliverySection,
    pickupSection,
    deliveryBanner: crossDateBanner({
      workType: "delivery",
      workDate: deliveryWork,
      eventDate: event,
    }),
    pickupBanner: crossDateBanner({
      workType: "pickup",
      workDate: pickupWork,
      eventDate: event,
    }),
  };
}

/** Pure check: moving work date must not change event date. */
export function movedWorkPreservesEventDate(args: {
  eventDateBefore: string;
  eventDateAfter: string;
  workDateBefore: string | null;
  workDateAfter: string;
}): boolean {
  return (
    args.eventDateBefore.slice(0, 10) === args.eventDateAfter.slice(0, 10) &&
    args.workDateAfter !== args.workDateBefore
  );
}

export function sequencesScopedPerDate(
  tasks: Array<{ id: string; workDate: string; sequence: number | null }>,
): Map<string, string[]> {
  const byDate = new Map<string, Array<{ id: string; sequence: number | null }>>();
  for (const task of tasks) {
    const list = byDate.get(task.workDate) ?? [];
    list.push(task);
    byDate.set(task.workDate, list);
  }
  const result = new Map<string, string[]>();
  for (const [date, list] of byDate) {
    result.set(
      date,
      [...list]
        .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999) || a.id.localeCompare(b.id))
        .map((item) => item.id),
    );
  }
  return result;
}
