import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadScheduleEvents, calendarDay, parseScheduleDate } from "@/lib/admin/schedule";
import { rentalWeekend, shiftCalendarDate } from "@/lib/admin/weekend";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../../_components";
import { ScheduleCalendar } from "../ScheduleCalendar";

export const dynamic = "force-dynamic";

export default async function WeekendSchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const { date } = await searchParams;
  const range = rentalWeekend(date);
  const result = await loadScheduleEvents(range).then(events => ({ events, error: null })).catch(() => ({ events: [], error: "The weekend schedule could not load. Please retry before printing." }));
  const href = (date: string) => `/admin/schedule/weekend?date=${date}`;
  return <AdminShell>
    <AdminHeader eyebrow="Front Desk" title="Weekend Rental Schedule" />
    <AdminNav token="" role={auth.role} active="weekend" />
    <form className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
      <label className="text-sm font-bold text-slate-700">Choose a weekend
        <input type="date" name="date" defaultValue={range.from} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950" />
      </label>
      <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white hover:bg-sky-600">View weekend</button>
      <Link href="/admin/schedule/weekend" className="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold">This weekend</Link>
    </form>
    <section className="schedule-main-panel mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:mt-0 print:border-0 print:p-0 print:shadow-none">
      <ScheduleCalendar key={range.from} weekend days={range.dates.map(day => calendarDay(parseScheduleDate(day)))} events={result.events} error={result.error} view="week"
        heading={`Weekend rentals: ${range.from} to ${range.to}`} rangeLabel={`${range.from} to ${range.to}`}
        previousHref={href(shiftCalendarDate(range.from, -7))} nextHref={href(shiftCalendarDate(range.from, 7))}
        dayHref={`/admin/schedule?view=day&date=${range.from}`} weekHref={`/admin/schedule?view=week&date=${range.from}`} monthHref={`/admin/schedule?view=month&date=${range.from}`} />
    </section>
  </AdminShell>;
}
