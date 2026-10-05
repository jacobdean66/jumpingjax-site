import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "@/app/admin/_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { driverId, loadKnownDriverNames } from "@/lib/admin/driver-auth";
import { loadDriverAccounts } from "@/lib/admin/driver-accounts";
import { todayYmd, isYmd } from "@/lib/admin/delivery-planner-dates";
import { loadDriverTripHistory } from "@/lib/admin/driver-trip-history-data";
import { DriverTripHistoryClient } from "./DriverTripHistoryClient";

export const dynamic = "force-dynamic";
export default async function DriverTripHistoryPage({ searchParams }: {
  searchParams?: Promise<{ date?: string; driver?: string }>;
}) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams;
  const date = isYmd(params?.date) ? params.date : todayYmd();
  const selectedDriver = params?.driver ?? "";
  let error: string | null = null;
  let history: Awaited<ReturnType<typeof loadDriverTripHistory>> = { date, trips: [], omittedPoints: 0 };
  const drivers = new Map<string, string>();
  const [result, known, accounts] = await Promise.allSettled([
    loadDriverTripHistory({ date, driverId: selectedDriver || undefined }), loadKnownDriverNames(), loadDriverAccounts(),
  ]);
  if (result.status === "fulfilled") history = result.value;
  else error = result.reason instanceof Error ? result.reason.message : "Route history could not be loaded.";
  const names = [...(known.status === "fulfilled" ? known.value : []), ...(accounts.status === "fulfilled" ? accounts.value.map((account) => account.display_name) : [])];
  for (const name of names) drivers.set(driverId(name), name);
  for (const trip of history.trips) drivers.set(trip.driverId, trip.driverName);
  if (selectedDriver && !drivers.has(selectedDriver)) drivers.set(selectedDriver, selectedDriver.replace(/^driver:/, ""));

  return (
    <AdminShell>
      <AdminHeader eyebrow="Driver tracking" title="Routes & Stops">
        <p className="max-w-xl text-sm font-bold leading-relaxed text-slate-600">Review where each driver traveled, the truck and trailer used, and stops recorded during location sharing.</p>
      </AdminHeader>
      <AdminNav active="driver-locations" role={auth.role} token="" />
      <Link href="/admin/driver-locations" className="mt-4 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-black ring-1 ring-slate-200">Live locations</Link>
      <form action="/admin/driver-locations/history" className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-bold">Date (Eastern time)
          <input type="date" name="date" defaultValue={date} required className="mt-1 block min-h-12 rounded-xl border border-slate-200 px-3" />
        </label>
        <label className="text-sm font-bold">Driver
          <select name="driver" defaultValue={selectedDriver} className="mt-1 block min-h-12 rounded-xl border border-slate-200 px-3">
            <option value="">All drivers</option>
            {[...drivers].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <button className="min-h-12 rounded-xl bg-slate-950 px-5 py-3 font-black text-white">Load History</button>
      </form>
      {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 font-bold text-rose-900">{error}</p> :
        <DriverTripHistoryClient key={`${date}:${selectedDriver}`} trips={history.trips} omittedPoints={history.omittedPoints} />}
    </AdminShell>
  );
}
