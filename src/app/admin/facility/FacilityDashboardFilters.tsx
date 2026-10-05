import Link from "next/link";
import type { FacilityPartyView } from "@/lib/admin/facility-dashboard";

export function FacilityDashboardFilters({ token, view, today, from, to, status, kind, search, deposit }: {
  token: string; view: FacilityPartyView; today: string; from: string; to: string;
  status: string; kind: string; search: string; deposit: string;
}) {
  const inputClass = "mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950";
  return (
    <div className="mt-5 print:hidden">
      <nav aria-label="Party dates" className="flex flex-wrap gap-2">
        {(["upcoming", "past"] as const).map((tab) => (
          <Link key={tab} prefetch={false} aria-current={view === tab ? "page" : undefined}
            href={`/admin/facility?${new URLSearchParams({ ...(token ? { token } : {}), view: tab })}`}
            className={`rounded-xl px-5 py-3 text-sm font-black ${view === tab ? "bg-pink-700 text-white" : "border border-slate-200 bg-white text-slate-950 hover:bg-pink-50"}`}>
            {tab === "past" ? "Past parties" : "Today & future parties"}
          </Link>
        ))}
      </nav>
      <form key={`${view}-${from}-${to}-${status}-${kind}-${search}-${deposit}`} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
        {token ? <input type="hidden" name="token" value={token} /> : null}
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="kind" value={kind} />
        <label className="text-sm font-bold text-slate-700">Search {view === "past" ? "past parties" : "parties"}
          <input type="search" name="q" defaultValue={search} placeholder="Child, parent, date, or phone" className={inputClass} />
        </label>
        <label className="text-sm font-bold text-slate-700">From
          <input type="date" name="from" defaultValue={from} min={view === "upcoming" ? today : undefined} className={inputClass} />
        </label>
        <label className="text-sm font-bold text-slate-700">To
          <input type="date" name="to" defaultValue={to} className={inputClass} />
        </label>
        <label className="text-sm font-bold text-slate-700">Status
          <select name="status" defaultValue={status} className={inputClass}>
            <option value="all">All</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">Deposit
          <select name="deposit" defaultValue={deposit} className={inputClass}>
            <option value="all">All</option><option value="paid">Paid</option><option value="unrecorded">Not paid</option><option value="review">Needs verification</option>
          </select>
        </label>
        <button className="min-h-11 rounded-lg bg-sky-600 px-5 py-2 text-sm font-black text-white hover:bg-sky-700">Search</button>
      </form>
      <p className="mt-3 text-sm font-semibold text-slate-600">
        {view === "past" ? "Past parties, newest first. Search all previous dates or choose a date range." : "Today and all future party dates, earliest first."} Parties move to Past parties at 12 am Eastern after their party date.
      </p>
    </div>
  );
}
