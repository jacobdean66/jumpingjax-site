import { loadInventoryDamageReports } from "@/lib/admin/damage-reports";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
  StatTile,
} from "../_components";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    message?: string;
    error?: string;
  }>;
};

const ITEM_TYPES = ["Inflatable", "Blower", "Drop cord", "Truck", "Other"];
const SEVERITIES = ["Needs review", "Can still rent", "Do not rent", "Fixed"];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminDamageLogPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess();

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  let reports: Awaited<ReturnType<typeof loadInventoryDamageReports>> = [];
  let loadError: string | null = null;
  try {
    reports = await loadInventoryDamageReports();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Damage log could not load";
  }

  const openCount = reports.filter((report) => report.status === "Open").length;
  const doNotRentCount = reports.filter((report) => report.severity === "Do not rent").length;
  const fixedCount = reports.filter((report) => report.severity === "Fixed").length;

  return (
    <AdminShell>
      <AdminHeader eyebrow="Inventory" title="Damage Log" />
      <AdminNav token={token} role={auth.role} active="damage-log" />

      {resolved?.message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          {resolved.message}
        </div>
      ) : null}
      {resolved?.error || loadError ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-950">
          {resolved?.error ?? loadError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Open reports" value={openCount} />
        <StatTile label="Do not rent" value={doNotRentCount} />
        <StatTile label="Fixed" value={fixedCount} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          action="/api/admin/damage-log"
          method="post"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="token" value={token} />
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              New report
            </p>
            <h2 className="mt-2 text-2xl font-black">Log damaged inventory</h2>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <p className="text-sm font-black text-slate-700">Item type</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ITEM_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    <input
                      type="radio"
                      name="itemType"
                      value={type}
                      defaultChecked={type === "Inflatable"}
                      className="h-4 w-4"
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <label className="text-sm font-bold text-slate-700">
              Item name or number
              <input
                name="itemName"
                required
                placeholder="Example: Blower 2, red drop cord, 18 ft slide"
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
              />
            </label>

            <label className="text-sm font-bold text-slate-700">
              What is wrong?
              <textarea
                name="issueSummary"
                required
                rows={4}
                placeholder="Example: zipper torn, blower making noise, plug bent"
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
              />
            </label>

            <div>
              <p className="text-sm font-black text-slate-700">Severity</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {SEVERITIES.map((severity) => (
                  <label
                    key={severity}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    <input
                      type="radio"
                      name="severity"
                      value={severity}
                      defaultChecked={severity === "Needs review"}
                      className="h-4 w-4"
                    />
                    {severity}
                  </label>
                ))}
              </div>
            </div>

            <label className="text-sm font-bold text-slate-700">
              Action needed
              <input
                name="actionNeeded"
                placeholder="Example: replace cord, patch seam, test before rental"
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">
                Reported by
                <input
                  name="reportedBy"
                  defaultValue={auth.identity.name}
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Booking ID
                <input
                  name="relatedBookingId"
                  placeholder="Optional"
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                />
              </label>
            </div>

            <label className="text-sm font-bold text-slate-700">
              Extra notes
              <textarea
                name="notes"
                rows={3}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
              />
            </label>

            <button className="min-h-12 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
              Save Damage Report
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Recent
            </p>
            <h2 className="mt-2 text-2xl font-black">Latest damage reports</h2>
          </div>
          <div className="mt-4 grid max-h-[820px] gap-3 overflow-y-auto pr-1">
            {reports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                No damage reports yet.
              </div>
            ) : (
              reports.map((report) => (
                <article
                  key={report.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                        {report.itemType} - {formatDate(report.reportedAt)}
                      </p>
                      <h3 className="mt-1 text-lg font-black">{report.itemName}</h3>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                      {report.severity}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    {report.issueSummary}
                  </p>
                  {report.actionNeeded ? (
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-black">Action:</span> {report.actionNeeded}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Reported by {report.reportedBy ?? "staff"}
                    {report.relatedBookingId ? ` - Booking ${report.relatedBookingId}` : ""}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
