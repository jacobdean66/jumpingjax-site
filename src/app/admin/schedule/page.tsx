import Link from "next/link";
import { verifyAdminDeliveryToken } from "@/lib/admin/delivery-auth";

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
              Use this as the schedule hub for rentals, facility parties, and
              delivery planning. Open the dashboards below to review live booking
              details.
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
                {view} view
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

          <div className="mt-6 grid gap-3 md:grid-cols-7">
            {DAYS.map((day) => (
              <p key={day} className="hidden text-center text-xs font-black uppercase tracking-wide text-slate-500 md:block">
                {day}
              </p>
            ))}
            {visibleDays.map((day) => (
              <div
                key={toYmd(day)}
                className="min-h-32 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm font-black text-slate-500">
                  {DAYS[day.getDay()]}
                </p>
                <h3 className="mt-1 text-xl font-black">{formatShort(day)}</h3>
                <div className="mt-4 grid gap-2">
                  <Link className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm" href={`/admin/rentals?${query}&from=${toYmd(day)}&to=${toYmd(day)}&status=all`}>
                    Rental bookings
                  </Link>
                  <Link className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm" href={`/admin/facility?${query}&from=${toYmd(day)}&to=${toYmd(day)}&status=all`}>
                    Facility parties
                  </Link>
                  <Link className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm" href={`/admin/deliveries?${query}`}>
                    Route planning
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
