import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  ScheduleCalendar,
  type CalendarDay,
  type CalendarEvent,
} from "./ScheduleCalendar";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    date?: string;
    view?: string;
  }>;
};

type ScheduleView = "day" | "week" | "month";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

type FacilityRow = {
  id: string;
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

function AuthError({
  reason,
}: {
  reason: "missing_config" | "invalid_token";
}) {
  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
          Jumping Jax Admin
        </p>
        <h1 className="mt-3 text-3xl font-black">
          {reason === "missing_config"
            ? "Admin token not configured"
            : "Invalid admin link"}
        </h1>
      </section>
    </main>
  );
}

function parseDate(value: string | undefined): Date {
  if (!value) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function toYmd(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function startOfWeek(value: Date): Date {
  return addDays(value, -value.getDay());
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function monthGrid(value: Date): Date[] {
  const first = startOfMonth(value);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function weekGrid(value: Date): Date[] {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatShort(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatTime(value: string | null): string {
  if (!value) return "Time not set";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hourRaw = Number(match[1]);
  const minute = Number(match[2]);
  const hour = hourRaw % 12 || 12;
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
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
  if (!address) return "Rental";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2] ?? "Rental";
  if (parts.length >= 2) return parts[parts.length - 1] ?? "Rental";
  return "Rental";
}

function viewFromParam(value: string | undefined): ScheduleView {
  if (value === "day" || value === "week") return value;
  return "month";
}

function scheduleHref(token: string, view: ScheduleView, date: Date): string {
  const params = new URLSearchParams({
    token,
    view,
    date: toYmd(date),
  });
  return `/admin/schedule?${params.toString()}`;
}

function calendarDay(value: Date): CalendarDay {
  return {
    ymd: toYmd(value),
    dayName: DAYS[value.getDay()] ?? "",
    label: formatShort(value),
  };
}

function rangeForView(view: ScheduleView, focus: Date) {
  if (view === "day") {
    return { from: toYmd(focus), to: toYmd(focus) };
  }
  if (view === "week") {
    const start = startOfWeek(focus);
    return { from: toYmd(start), to: toYmd(addDays(start, 6)) };
  }
  return { from: toYmd(startOfMonth(focus)), to: toYmd(endOfMonth(focus)) };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function loadScheduleEvents(input: {
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
      .order("event_date", { ascending: true })
      .order("event_start_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("facility_bookings")
      .select(
        "id, status, customer_name, email, phone, room, readable_date, readable_time, party_label, start_time, end_time, parent_name, child_name, child_age, party_theme, notes, payment_method, total",
      )
      .gte("readable_date", input.from)
      .lte("readable_date", input.to)
      .order("start_time", { ascending: true }),
  ]);

  if (rentals.error) throw new Error(rentals.error.message);
  if (facility.error) throw new Error(facility.error.message);

  const rentalEvents = ((rentals.data ?? []) as RentalRow[]).map(
    (row): CalendarEvent => ({
      id: `rental-${row.id}`,
      kind: "rental",
      date: String(row.event_date).slice(0, 10),
      time: clean(row.event_start_time) ?? clean(row.requested_delivery_window),
      displayTime: formatTime(clean(row.event_start_time) ?? clean(row.requested_delivery_window)),
      title: clean(row.rental_name) ?? clean(row.rental_item) ?? "Rental",
      customer: clean(row.customer_name) ?? "Guest",
      phone: clean(row.customer_phone),
      email: clean(row.customer_email),
      status: clean(row.status) ?? "pending",
      city: rentalCity(clean(row.event_address)),
      details: [
        { label: "Customer", value: clean(row.customer_name) },
        { label: "Phone", value: clean(row.customer_phone) },
        { label: "Email", value: clean(row.customer_email) },
        { label: "Rental", value: clean(row.rental_name) ?? clean(row.rental_item) },
        { label: "Date", value: String(row.event_date).slice(0, 10) },
        { label: "Start time", value: formatTime(clean(row.event_start_time)) },
        {
          label: "Delivery window",
          value: clean(row.requested_delivery_window) ?? clean(row.delivery_time),
        },
        { label: "City", value: rentalCity(clean(row.event_address)) },
        { label: "Address", value: clean(row.event_address) },
        { label: "Setup location", value: clean(row.setup_location) },
        { label: "Surface", value: clean(row.setup_surface) },
        { label: "Access", value: clean(row.setup_access) },
        { label: "Setup notes", value: clean(row.setup_notes) },
        { label: "Payment", value: clean(row.payment_method) },
        { label: "Total", value: money(row.total) },
        { label: "Status", value: clean(row.status) },
      ],
    }),
  );

  const facilityEvents = ((facility.data ?? []) as FacilityRow[]).map(
    (row): CalendarEvent => ({
      id: `facility-${row.id}`,
      kind: "facility",
      date: clean(row.readable_date) ?? String(row.start_time).slice(0, 10),
      time: clean(row.readable_time),
      displayTime: formatTime(clean(row.readable_time)),
      title: clean(row.party_label) ?? "Facility party",
      customer: clean(row.customer_name) ?? "Guest",
      phone: clean(row.phone),
      email: clean(row.email),
      status: clean(row.status) ?? "pending",
      city: null,
      details: [
        { label: "Customer", value: clean(row.customer_name) },
        { label: "Phone", value: clean(row.phone) },
        { label: "Email", value: clean(row.email) },
        { label: "Party", value: clean(row.party_label) },
        { label: "Room", value: clean(row.room) },
        { label: "Date", value: clean(row.readable_date) ?? String(row.start_time).slice(0, 10) },
        { label: "Time", value: clean(row.readable_time) },
        { label: "Start", value: row.start_time },
        { label: "End", value: row.end_time },
        { label: "Parent", value: clean(row.parent_name) },
        { label: "Child", value: clean(row.child_name) },
        { label: "Child age", value: clean(row.child_age) },
        { label: "Theme", value: clean(row.party_theme) },
        { label: "Notes", value: clean(row.notes) },
        { label: "Payment", value: clean(row.payment_method) },
        { label: "Total", value: money(row.total) },
        { label: "Status", value: clean(row.status) },
      ],
    }),
  );

  return [...rentalEvents, ...facilityEvents].sort((a, b) =>
    `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`),
  );
}

function groupEventsByDate(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
    groups[event.date] = [...(groups[event.date] ?? []), event];
    return groups;
  }, {});
}

export default async function AdminSchedulePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AuthError reason={auth.reason} />;

  const view = viewFromParam(resolved?.view);
  const focus = parseDate(resolved?.date);
  const query = `token=${encodeURIComponent(token)}`;
  const visibleDays =
    view === "day" ? [focus] : view === "week" ? weekGrid(focus) : monthGrid(focus);
  const range = rangeForView(view, focus);
  const eventsResult = await withTimeout(
    loadScheduleEvents(range),
    2500,
    "Supabase schedule data timed out.",
  )
    .then((events) => ({ events, error: null }))
    .catch((error) => ({
      events: [] as CalendarEvent[],
      error:
        error instanceof Error ? error.message : "Unable to load schedule.",
    }));
  const eventsByDate = groupEventsByDate(eventsResult.events);

  return (
    <main className="min-h-screen bg-[#eef3f8] text-slate-950">
      <section className="border-b-4 border-pink-500 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link href={`/admin?${query}`} className="text-3xl font-black text-pink-600">
            Jumping Jax Admin
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm font-black">
            <Link className="rounded-full bg-slate-950 px-4 py-2 text-white" href={`/admin?${query}`}>
              Admin Home
            </Link>
            <Link className="rounded-full bg-violet-600 px-4 py-2 text-white" href={`/admin/ai-ads?${query}`}>
              AI Ads
            </Link>
            <Link className="rounded-full bg-emerald-100 px-4 py-2 text-slate-950" href={`/admin/deliveries?${query}`}>
              Route Planner
            </Link>
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <header>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-sky-700">
              Admin Schedule
            </p>
            <h1 className="mt-3 text-5xl font-black leading-none md:text-7xl">
              Schedule View
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-600">
              Calendar view for live rentals and facility parties. Empty days
              stay empty instead of sending you to pages with no bookings.
            </p>
          </header>

          <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="token" value={token} />
            <label className="text-sm font-black text-slate-700">
              Focus date
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-base font-bold outline-none focus:border-sky-500"
                type="date"
                name="date"
                defaultValue={toYmd(focus)}
              />
            </label>
            <label className="mt-4 block text-sm font-black text-slate-700">
              View
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-base font-bold outline-none focus:border-sky-500"
                name="view"
                defaultValue={view}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </label>
            <button className="mt-5 w-full rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white">
              Load schedule
            </button>
          </form>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {view} view - {eventsResult.events.length} booking{eventsResult.events.length === 1 ? "" : "s"}
              </p>
              <h2 className="mt-1 text-3xl font-black">{formatDate(focus)}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black" href={scheduleHref(token, view, addDays(focus, view === "month" ? -30 : view === "week" ? -7 : -1))}>
                Previous
              </Link>
              <Link className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white" href={scheduleHref(token, "day", focus)}>
                Day
              </Link>
              <Link className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black" href={scheduleHref(token, "week", focus)}>
                Week
              </Link>
              <Link className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black" href={scheduleHref(token, "month", focus)}>
                Month
              </Link>
              <Link className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black" href={scheduleHref(token, view, addDays(focus, view === "month" ? 30 : view === "week" ? 7 : 1))}>
                Next
              </Link>
            </div>
          </div>

          {eventsResult.error && (
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-black text-rose-900">
                Schedule data could not load: {eventsResult.error}
              </p>
              <p className="mt-1 text-sm font-semibold text-rose-800">
                This should clear after the Supabase project is restored.
              </p>
            </div>
          )}

          <ScheduleCalendar
            days={visibleDays.map(calendarDay)}
            eventsByDate={eventsByDate}
          />
        </section>
      </section>
    </main>
  );
}
