import { createServiceRoleClient } from "@/lib/supabase/admin";
import { RENTAL_OPERATIONAL_STATUSES } from "@/lib/bookings/rental-lifecycle";
import {
  aggregateScheduleProducts,
  classifyRentalScheduleType,
  formatProductLabel,
  type ScheduleProduct,
} from "./schedule-products";

export type ScheduleView = "day" | "week" | "month";
export type ScheduleEventType =
  | "rental"
  | "foam-party"
  | "public-party"
  | "private-party";
export type ScheduleFilters = Record<ScheduleEventType, boolean>;

export type CalendarDay = {
  ymd: string;
  dayName: string;
  label: string;
};

export type CalendarEvent = {
  id: string;
  bookingId: string;
  type: ScheduleEventType;
  date: string;
  sortTime: string;
  displayTime: string;
  title: string;
  customer: string;
  phone: string | null;
  status: string;
  location: string | null;
  room: string | null;
  detailHref: string;
  products: ScheduleProduct[];
  details: { label: string; value: string | null }[];
};

type RentalRow = {
  id: number | string;
  status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  rental_item: string | null;
  rental_name: string | null;
  event_address: string | null;
  event_date: string;
  event_start_time: string | null;
  requested_delivery_window: string | null;
  delivery_time: string | null;
  setup_location: string | null;
  setup_surface: string | null;
  setup_access: string | null;
  setup_notes: string | null;
  payment_method: string | null;
  total: number | string | null;
};

type RentalItemRow = {
  booking_id: number | string;
  rental_item: string | null;
  rental_name: string | null;
};

type FacilityRow = {
  id: string;
  party_kind: string | null;
  status: string | null;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  room: string | null;
  readable_date: string | null;
  readable_time: string | null;
  party_label: string | null;
  start_time: string;
  end_time: string;
  parent_name: string | null;
  child_name: string | null;
  child_age: string | null;
  party_theme: string | null;
  notes: string | null;
  payment_method: string | null;
  total: number | string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DEFAULT_SCHEDULE_FILTERS: ScheduleFilters = {
  rental: true,
  "foam-party": true,
  "public-party": true,
  "private-party": true,
};

const CANCELLED_SCHEDULE_STATUSES = new Set(["cancelled", "canceled"]);

export function isCancelledStatus(status: string | null | undefined): boolean {
  return CANCELLED_SCHEDULE_STATUSES.has(status?.trim().toLowerCase() ?? "");
}

export function parseScheduleDate(value: string | undefined): Date {
  if (!value) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export function toYmd(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, value.getDate());
}

export function startOfWeek(value: Date): Date {
  return addDays(value, -value.getDay());
}

export function endOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

export function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function weekGrid(value: Date): Date[] {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthGrid(value: Date): Date[] {
  const first = startOfMonth(value);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function viewFromParam(value: string | undefined): ScheduleView {
  if (value === "day" || value === "week" || value === "month") return value;
  return "week";
}

export function visibleDatesForView(view: ScheduleView, focus: Date): Date[] {
  if (view === "day") return [focus];
  if (view === "week") return weekGrid(focus);
  return monthGrid(focus);
}

export function rangeForView(view: ScheduleView, focus: Date) {
  if (view === "day") return { from: toYmd(focus), to: toYmd(focus) };
  if (view === "week") {
    const start = startOfWeek(focus);
    return { from: toYmd(start), to: toYmd(addDays(start, 6)) };
  }
  return { from: toYmd(startOfMonth(focus)), to: toYmd(endOfMonth(focus)) };
}

export function nextFocusDate(
  view: ScheduleView,
  focus: Date,
  direction: -1 | 1,
): Date {
  if (view === "day") return addDays(focus, direction);
  if (view === "week") return addDays(focus, direction * 7);
  return addMonths(focus, direction);
}

export function formatFullDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export function formatShortDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatMonthDay(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(value);
}

export function headingForView(view: ScheduleView, focus: Date): string {
  if (view === "day") return formatFullDate(focus);
  if (view === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(focus);
  }

  const start = startOfWeek(focus);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth && sameYear) {
    return `${formatMonthDay(start).replace(/ \d+$/, "")} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${formatMonthDay(start)} - ${formatMonthDay(end)}, ${end.getFullYear()}`;
  }
  return `${formatMonthDay(start)}, ${start.getFullYear()} - ${formatMonthDay(end)}, ${end.getFullYear()}`;
}

export function calendarDay(value: Date): CalendarDay {
  return {
    ymd: toYmd(value),
    dayName: DAYS[value.getDay()] ?? "",
    label: formatShortDate(value),
  };
}

export function filterScheduleEvents(
  events: readonly CalendarEvent[],
  filters: ScheduleFilters,
  showCancelled = false,
): CalendarEvent[] {
  return events.filter(
    (event) =>
      filters[event.type] && isCancelledStatus(event.status) === showCancelled,
  );
}

export function groupEventsByDate(events: readonly CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
    groups[event.date] = [...(groups[event.date] ?? []), event];
    return groups;
  }, {});
}

export function selectedFilterLabels(filters: ScheduleFilters): string[] {
  const labels: Record<ScheduleEventType, string> = {
    rental: "Rentals",
    "foam-party": "Foam Parties",
    "public-party": "Public facility parties",
    "private-party": "Private facility parties",
  };
  return (Object.keys(filters) as ScheduleEventType[])
    .filter((type) => filters[type])
    .map((type) => labels[type]);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatTime(value: string | null): string {
  if (!value) return "Time not set";
  if (isPlaceholderMidnight(value)) return "Time not set";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hourRaw = Number(match[1]);
  const minute = Number(match[2]);
  const hour = hourRaw % 12 || 12;
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function isPlaceholderMidnight(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "");
  return (
    normalized === "0:00am" ||
    normalized === "00:00" ||
    normalized === "00:00:00" ||
    normalized === "12:00am" ||
    normalized === "12:00:00am"
  );
}

function cleanTime(value: string | null | undefined): string | null {
  const trimmed = clean(value);
  if (!trimmed || isPlaceholderMidnight(trimmed)) return null;
  return trimmed;
}

function money(value: number | string | null): string | null {
  if (value === null) return null;
  const parsed =
    typeof value === "string" ? Number(value.replace(/[^0-9.-]/g, "")) : value;
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(parsed);
}

function rentalCity(address: string | null): string {
  if (!address) return "Rental location not set";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2] ?? address;
  if (parts.length >= 2) return parts[parts.length - 1] ?? address;
  return address;
}

function roomLabel(room: string | null) {
  if (room === "room-10") return "10 kid party room";
  if (room === "room-20") return "20 kid party room";
  return room;
}

export function rentalRowsToEvents(
  rows: readonly RentalRow[],
  itemsByBookingId: ReadonlyMap<string, RentalItemRow[]> = new Map(),
): CalendarEvent[] {
  return rows.map((row) => {
    const bookingId = String(row.id);
    const date = String(row.event_date).slice(0, 10);
    const time =
      cleanTime(row.event_start_time) ??
      cleanTime(row.requested_delivery_window) ??
      cleanTime(row.delivery_time);
    const fallbackItems: RentalItemRow[] = [
      {
        booking_id: row.id,
        rental_item: row.rental_item,
        rental_name: row.rental_name ?? row.rental_item,
      },
    ];
    const rawItems = itemsByBookingId.get(bookingId) ?? fallbackItems;
    const products = aggregateScheduleProducts(rawItems);
    const type = classifyRentalScheduleType(products);
    const title =
      products.length > 0
        ? products.map(formatProductLabel).join(", ")
        : clean(row.rental_name) ?? clean(row.rental_item) ?? "Rental";
    return {
      id: `rental-${row.id}`,
      bookingId,
      type,
      date,
      sortTime: time ?? "",
      displayTime: formatTime(time),
      title,
      customer: clean(row.customer_name) ?? "Guest",
      phone: clean(row.customer_phone),
      status: clean(row.status) ?? "pending",
      location: clean(row.event_address) ?? rentalCity(clean(row.event_address)),
      room: null,
      detailHref: `/admin/rentals?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}#booking-${encodeURIComponent(bookingId)}`,
      products,
      details: [
        { label: "Customer", value: clean(row.customer_name) },
        { label: "Products", value: title },
        { label: "Date", value: date },
        { label: "Time", value: formatTime(time) },
        {
          label: "Delivery window",
          value: cleanTime(row.requested_delivery_window) ?? cleanTime(row.delivery_time),
        },
        { label: "Address", value: clean(row.event_address) },
        { label: "City", value: rentalCity(clean(row.event_address)) },
        { label: "Phone", value: clean(row.customer_phone) },
        { label: "Email", value: clean(row.customer_email) },
        { label: "Setup location", value: clean(row.setup_location) },
        { label: "Surface", value: clean(row.setup_surface) },
        { label: "Access", value: clean(row.setup_access) },
        { label: "Setup notes", value: clean(row.setup_notes) },
        { label: "Payment", value: clean(row.payment_method) },
        { label: "Total", value: money(row.total) },
        { label: "Status", value: clean(row.status) },
      ],
    };
  });
}

export function facilityRowsToEvents(
  rows: readonly FacilityRow[],
): CalendarEvent[] {
  return rows.map((row) => {
    const type: ScheduleEventType =
      row.party_kind === "private" ? "private-party" : "public-party";
    const date = clean(row.readable_date) ?? String(row.start_time).slice(0, 10);
    const room = roomLabel(clean(row.room));
    const readableTime = cleanTime(row.readable_time);
    return {
      id: `facility-${row.id}`,
      bookingId: String(row.id),
      type,
      date,
      sortTime: clean(row.start_time) ?? readableTime ?? "",
      displayTime: readableTime ?? formatTime(clean(row.start_time)),
      title:
        clean(row.party_label) ??
        (type === "private-party" ? "Private facility party" : "Public facility party"),
      customer: clean(row.customer_name) ?? "Guest",
      phone: clean(row.phone),
      status: clean(row.status) ?? "pending",
      location: null,
      room,
      detailHref: `/admin/facility?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}#booking-${encodeURIComponent(String(row.id))}`,
      products: [],
      details: [
        { label: "Customer", value: clean(row.customer_name) },
        { label: "Party", value: clean(row.party_label) },
        { label: "Room", value: room },
        { label: "Date", value: date },
        { label: "Time", value: readableTime },
        { label: "Start", value: row.start_time },
        { label: "End", value: row.end_time },
        { label: "Parent", value: clean(row.parent_name) },
        { label: "Child", value: clean(row.child_name) },
        { label: "Child age", value: clean(row.child_age) },
        { label: "Theme", value: clean(row.party_theme) },
        { label: "Phone", value: clean(row.phone) },
        { label: "Email", value: clean(row.email) },
        { label: "Notes", value: clean(row.notes) },
        { label: "Payment", value: clean(row.payment_method) },
        { label: "Total", value: money(row.total) },
        { label: "Status", value: clean(row.status) },
      ],
    };
  });
}

export function sortScheduleEvents(
  events: readonly CalendarEvent[],
): CalendarEvent[] {
  return [...events].sort((a, b) =>
    `${a.date} ${a.sortTime} ${a.id}`.localeCompare(
      `${b.date} ${b.sortTime} ${b.id}`,
    ),
  );
}

export async function loadScheduleEvents(input: {
  from: string;
  to: string;
}): Promise<CalendarEvent[]> {
  const supabase = createServiceRoleClient();
  const [rentals, facility] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, status, customer_name, customer_email, customer_phone, rental_item, rental_name, event_address, event_date, event_start_time, requested_delivery_window, delivery_time, setup_location, setup_surface, setup_access, setup_notes, payment_method, total",
      )
      .gte("event_date", input.from)
      .lte("event_date", input.to)
      .in("status", [...RENTAL_OPERATIONAL_STATUSES, "cancelled", "canceled"])
      .order("event_date", { ascending: true })
      .order("event_start_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("facility_bookings")
      .select(
        "id, party_kind, status, customer_name, email, phone, room, readable_date, readable_time, party_label, start_time, end_time, parent_name, child_name, child_age, party_theme, notes, payment_method, total",
      )
      .gte("readable_date", input.from)
      .lte("readable_date", input.to)
      .order("start_time", { ascending: true }),
  ]);

  if (rentals.error) throw new Error(rentals.error.message);
  if (facility.error) throw new Error(facility.error.message);

  const rentalRows = (rentals.data ?? []) as RentalRow[];
  const rentalIds = rentalRows.map((row) => row.id);
  const itemsByBookingId = new Map<string, RentalItemRow[]>();

  if (rentalIds.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from("booking_rental_items")
      .select("booking_id, rental_item, rental_name")
      .in("booking_id", rentalIds);

    if (itemError) throw new Error(itemError.message);
    for (const item of (itemRows ?? []) as RentalItemRow[]) {
      const key = String(item.booking_id);
      itemsByBookingId.set(key, [...(itemsByBookingId.get(key) ?? []), item]);
    }
  }

  return sortScheduleEvents([
    ...rentalRowsToEvents(rentalRows, itemsByBookingId),
    ...facilityRowsToEvents((facility.data ?? []) as FacilityRow[]),
  ]);
}
