import { verifyAdminAccess } from "@/lib/admin/session";
import {
  calendarDay,
  headingForView,
  loadScheduleEvents,
  nextFocusDate,
  parseScheduleDate,
  rangeForView,
  toYmd,
  viewFromParam,
  visibleDatesForView,
  type CalendarEvent,
  type ScheduleView,
} from "@/lib/admin/schedule";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { ScheduleCalendar } from "./ScheduleCalendar";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    date?: string;
    view?: string;
  }>;
};

function scheduleHref(view: ScheduleView, date: Date): string {
  const params = new URLSearchParams({
    view,
    date: toYmd(date),
  });
  return `/admin/schedule?${params.toString()}`;
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

export default async function AdminSchedulePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const view = viewFromParam(resolved?.view);
  const focus = parseScheduleDate(resolved?.date);
  const visibleDays = visibleDatesForView(view, focus);
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

  return (
    <AdminShell>
      <AdminHeader eyebrow="Admin Schedule" title="Schedule View">
        <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-bold text-slate-700">
            Focus date
            <input
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
              type="date"
              name="date"
              defaultValue={toYmd(focus)}
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            View
            <select
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
              name="view"
              defaultValue={view}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-600">
            Load
          </button>
        </form>
      </AdminHeader>
      <AdminNav token={token} role={auth.role} active="schedule" />

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:mt-0 print:border-0 print:p-0 print:shadow-none">
        <ScheduleCalendar
          days={visibleDays.map(calendarDay)}
          events={eventsResult.events}
          error={eventsResult.error}
          view={view}
          heading={headingForView(view, focus)}
          rangeLabel={range.from === range.to ? range.from : `${range.from} to ${range.to}`}
          previousHref={scheduleHref(view, nextFocusDate(view, focus, -1))}
          nextHref={scheduleHref(view, nextFocusDate(view, focus, 1))}
          dayHref={scheduleHref("day", focus)}
          weekHref={scheduleHref("week", focus)}
          monthHref={scheduleHref("month", focus)}
          focusMonth={focus.getMonth()}
        />
      </section>
    </AdminShell>
  );
}
