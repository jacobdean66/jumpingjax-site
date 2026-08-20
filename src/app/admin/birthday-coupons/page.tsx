import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
import {
  loadBirthdayCouponAdminRows,
  type BirthdayCouponOutreachRow,
} from "@/lib/birthday-coupons/service";
import { birthdayAgeForYear } from "@/lib/birthday-coupons/date";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return value.slice(0, 10);
}

function BirthdayStatusBadge({ status }: { status: string }) {
  const tone =
    status === "sent"
      ? "border-emerald-200 bg-emerald-100 text-emerald-950"
      : status === "failed"
        ? "border-rose-200 bg-rose-100 text-rose-950"
        : status === "pending"
          ? "border-amber-200 bg-amber-100 text-amber-950"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}

function MonthAwayTable({
  title,
  rows,
}: {
  title: string;
  rows: BirthdayCouponOutreachRow[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs font-black uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">Child</th>
              <th className="py-2 pr-4">Turning</th>
              <th className="py-2 pr-4">Guardian Email</th>
              <th className="py-2 pr-4">Birthday</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="py-4 font-semibold text-slate-500" colSpan={5}>
                  No rows to show.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 font-bold">
                    {row.child_first_name} {row.child_last_name}
                  </td>
                  <td className="py-3 pr-4">
                    {birthdayAgeForYear(row.child_dob, row.birthday_year)}
                  </td>
                  <td className="py-3 pr-4">{row.signer_email}</td>
                  <td className="py-3 pr-4">{formatDate(row.birthday_date)}</td>
                  <td className="py-3 pr-4">
                    <BirthdayStatusBadge status={row.status} />
                    {row.last_error ? (
                      <p className="mt-1 text-xs font-semibold text-rose-700">
                        {row.last_error}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OutreachTable({
  title,
  rows,
}: {
  title: string;
  rows: BirthdayCouponOutreachRow[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs font-black uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">Send</th>
              <th className="py-2 pr-4">Birthday</th>
              <th className="py-2 pr-4">Child</th>
              <th className="py-2 pr-4">Guardian Email</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Attempts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="py-4 font-semibold text-slate-500" colSpan={6}>
                  No rows to show.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 font-bold">{formatDate(row.send_on)}</td>
                  <td className="py-3 pr-4">{formatDate(row.birthday_date)}</td>
                  <td className="py-3 pr-4 font-bold">
                    {row.child_first_name} {row.child_last_name}
                  </td>
                  <td className="py-3 pr-4">{row.signer_email}</td>
                  <td className="py-3 pr-4">
                    <BirthdayStatusBadge status={row.status} />
                    {row.last_error ? (
                      <p className="mt-1 text-xs font-semibold text-rose-700">
                        {row.last_error}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{row.attempt_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function BirthdayCouponsAdminPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  let rows: Awaited<ReturnType<typeof loadBirthdayCouponAdminRows>>;
  try {
    rows = await loadBirthdayCouponAdminRows();
  } catch {
    rows = { monthAway: [], upcoming: [], recent: [] };
  }

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Birthday Coupons" />
      <AdminNav token="" role={auth.role} active="open-play" />
      <OpenPlayDeskNav active="birthday-coupons" showOwnerTools />

      <section className="mt-8 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm font-semibold text-sky-950">
        Completed native waiver birthdays and guardian emails are imported here
        automatically. The cron route is <code>/api/cron/birthday-coupons</code>.
      </section>

      <div className="mt-6 grid gap-6">
        <MonthAwayTable title="One month away today" rows={rows.monthAway} />
        <OutreachTable title="Upcoming or retryable" rows={rows.upcoming} />
        <OutreachTable title="Recent outcomes" rows={rows.recent} />
      </div>
    </AdminShell>
  );
}
