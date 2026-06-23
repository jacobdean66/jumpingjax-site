import Link from "next/link";
import { verifyAdminDeliveryToken } from "@/lib/admin/delivery-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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
  customer_phone: string | null;
  rental_item: string | null;
  rental_name: string | null;
  event_address: string | null;
  event_date: string;
  event_start_time: string | null;
  requested_delivery_window: string | null;
};

type FacilityRow = {
  id: string;
  status: string | null;
  customer_name: string | null;
  phone: string | null;
  readable_date: string | null;
  readable_time: string | null;
  party_label: string | null;
  start_time: string;
};

type ScheduleEvent = {
  id: string;
  kind: "rental" | "facility";
  date: string;
  time: string | null;
  title: string;
  customer: string;
  phone: string | null;
  status: string;
  city: string | null;
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
}): Promise<ScheduleEvent[]> {
  const supabase = createServiceRoleClient();
  const [rentals, facility] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, status, customer_name, customer_phone, rental_item, rental_name, event_address, event_date, event_start_time, requested_delivery_window",
      )
      .gte("event_date", input.from)
      .lte("event_date", input.to)
      .order("event_date", { ascending: true })
      .order("event_start_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("facility_bookings")
      .select(
        "id, status, customer_name, phone, readable_date, readable_time, party_label, start_time",
      )
      .gte("readable_date", input.from)
      .lte("readable_date", input.to)
      .order("start_time", { ascending: true }),
  ]);

  if (rentals.error) throw new Error(rentals.error.message);
  if (facility.error) throw new Error(facility.error.message);

  const rentalEvents = ((rentals.data ?? []) as RentalRow[]).map(
    (row): ScheduleEvent => ({
      id: `rental-${row.id}`,
      kind: "rental",
      date: String(row.event_date).slice(0, 10),
      time: clean(row.event_start_time) ?? clean(row.requested_delivery_window),
      title: clean(row.rental_name) ?? clean(row.rental_item) ?? "Rental",
      customer: clean(row.customer_name) ?? "Guest",
      phone: clean(row.customer_phone),
      status: clean(row.status) ?? "pending",
      city: rentalCity(clean(row.event_address)),
    }),
  );

  const facilityEvents = ((facility.data ?? []) as FacilityRow[]).map(
    (row): ScheduleEvent => ({
      id: `facility-${row.id}`,
      kind: "facility",
      date: clean(row.readable_date) ?? String(row.start_time).slice(0, 10),
      time: clean(row.readable_time),
      title: clean(row.party_label) ?? "Facility party",
      customer: clean(row.customer_name) ?? "Guest",
      phone: clean(row.phone),
      status: clean(row.status) ?? "pending",
      city: null,
    }),
  );

  return [...rentalEvents, ...facilityEvents].sort((a, b) =>
    `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`),
  );
}

function groupEventsByDate(events: ScheduleEvent[]) {
  return events.reduce<Record<string, ScheduleEvent[]>>((groups, event) => {
    groups[event.date] = [...(groups[event.date] ?? []), event];
    return groups;
  }, {});
}

export default async function AdminSchedulePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = verifyAdminDeliveryToken(token);

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
      events: [] as ScheduleEvent[],
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

          <div className="mt-6 grid gap-3 md:grid-cols-7">
            {DAYS.map((day) => (
              <p key={day} className="hidden text-center text-xs font-black uppercase tracking-wide text-slate-500 md:block">
                {day}
              </p>
            ))}
            {visibleDays.map((day) => (
              <div
                key={toYmd(day)}
                className="flex aspect-square min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="shrink-0">
                  <p className="text-xs font-black text-slate-500">
                    {DAYS[day.getDay()]}
                  </p>
                  <h3 className="mt-1 text-lg font-black leading-none">
                    {formatShort(day)}
                  </h3>
                </div>
                <div className="mt-3 grid min-h-0 flex-1 gap-1.5 overflow-y-auto pr-1">
                  {(eventsByDate[toYmd(day)] ?? []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-white px-2 py-2 text-[10px] font-bold text-slate-500">
                      No bookings
                    </p>
                  ) : (
                    (eventsByDate[toYmd(day)] ?? []).map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg bg-white px-2 py-2 text-[10px] font-bold leading-tight text-slate-700 shadow-sm"
                      >
                        {event.kind === "rental" ? (
                          <>
                            <p className="font-black text-slate-950">
                              {event.city}: {event.title}
                            </p>
                            <p className="mt-1">
                              {formatTime(event.time)} - {event.customer}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-black text-slate-950">
                              {formatTime(event.time)} - {event.title}
                            </p>
                            <p className="mt-1">{event.customer}</p>
                          </>
                        )}
                        <p className="mt-1 truncate uppercase tracking-wide text-slate-500">
                          {event.status}
                          {event.phone ? ` | ${event.phone}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
