import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  loadEmployeeShifts,
  type EmployeeShift,
} from "@/lib/admin/employee-shifts";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    from?: string;
    to?: string;
    message?: string;
    error?: string;
  }>;
};

function todayYmd() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

function formatTime(value: string) {
  const [hourRaw, minuteRaw] = value.split(":").map(Number);
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return value;
  const hour = hourRaw % 12 || 12;
  return `${hour}:${String(minuteRaw).padStart(2, "0")} ${hourRaw >= 12 ? "PM" : "AM"}`;
}

function ShiftCard({ shift, token }: { shift: EmployeeShift; token: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            {formatDate(shift.shiftDate)}
          </p>
          <h3 className="mt-1 text-xl font-black">{shift.employeeName}</h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
          </p>
        </div>
        {shift.role ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
            {shift.role}
          </span>
        ) : null}
      </div>
      {shift.notes ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
          {shift.notes}
        </p>
      ) : null}
      <form action="/api/admin/employee-schedule/delete" method="post" className="mt-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="id" value={shift.id} />
        <button className="rounded-full border border-rose-200 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-50">
          Delete shift
        </button>
      </form>
    </article>
  );
}

export default async function EmployeeSchedulePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return <AdminAuthError reason={auth.reason} />;
  }

  const from = resolved?.from ?? todayYmd();
  const to = resolved?.to ?? addDays(from, 7);
  const shifts = await loadEmployeeShifts({ from, to });

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Admin" title="Employee Schedule" />
      <AdminNav token={token} role={auth.role} active="employee-schedule" />

      {resolved?.message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-950">
          {resolved.message}
        </div>
      ) : null}
      {resolved?.error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-950">
          {resolved.error}
        </div>
      ) : null}

      <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="token" value={token} />
        <label className="text-sm font-bold text-slate-700">
          From
          <input name="from" type="date" defaultValue={from} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
        </label>
        <label className="text-sm font-bold text-slate-700">
          To
          <input name="to" type="date" defaultValue={to} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
        </label>
        <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white">
          Load
        </button>
      </form>

      <form action="/api/admin/employee-schedule" method="post" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="token" value={token} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Employee name
            <input name="employeeName" required className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Date
            <input name="shiftDate" type="date" defaultValue={from} required className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Start
            <input name="startTime" type="time" required className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            End
            <input name="endTime" type="time" required className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Role
            <input name="role" placeholder="Front desk, driver, setup..." className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Notes
            <input name="notes" className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
          </label>
        </div>
        <button className="mt-4 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">
          Add Shift
        </button>
      </form>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {shifts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center font-bold text-slate-600">
            No shifts scheduled for this range.
          </div>
        ) : (
          shifts.map((shift) => <ShiftCard key={shift.id} shift={shift} token={token} />)
        )}
      </div>
    </AdminShell>
  );
}
