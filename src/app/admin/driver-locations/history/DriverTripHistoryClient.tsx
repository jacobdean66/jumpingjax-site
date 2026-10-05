"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { DriverTrip } from "@/lib/admin/driver-trip-history";
import { equipmentLabel } from "@/lib/admin/driver-trip-context";
const DriverTripMap = dynamic(() => import("./DriverTripMap"), { ssr: false, loading: () => <p className="mt-4 p-6 font-bold">Loading route map…</p> });
function time(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
}
export function DriverTripHistoryClient({ trips, omittedPoints }: { trips: DriverTrip[]; omittedPoints: number }) {
  const [selectedId, setSelectedId] = useState(trips[0]?.id ?? "");
  const router = useRouter();
  const trip = trips.find((item) => item.id === selectedId) ?? trips[0];
  if (!trip) return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
    <h2 className="text-xl font-black">No recorded routes for this selection.</h2>
    <p className="mt-2 text-sm font-semibold text-slate-600">History appears while a driver shares location or is signed into the phone app. Only recorded locations can be shown.</p>
    {omittedPoints > 0 ? <p className="mt-2 text-sm font-bold text-amber-800">{omittedPoints} inaccurate location updates were omitted.</p> : null}
  </section>;
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="min-w-0 flex-1 text-sm font-bold">Recorded trip
        <select value={trip.id} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 block min-h-12 w-full rounded-xl border border-slate-200 px-3">
          {trips.map((item) => <option key={item.id} value={item.id}>{item.driverName} · {equipmentLabel(item.vehicle, item.trailer)} · {time(item.startedAt)} · {item.source === "phone" ? "Phone" : "Browser"}</option>)}
        </select>
      </label>
      <button onClick={() => router.refresh()} className="min-h-12 rounded-xl bg-sky-600 px-4 py-3 font-black text-white">Refresh History</button>
    </div>
    <h2 className="mt-5 text-2xl font-black">{trip.driverName}</h2>
    <p className="mt-1 font-bold text-slate-600">{equipmentLabel(trip.vehicle, trip.trailer)}</p>
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["Recorded", `${time(trip.startedAt)}–${time(trip.endedAt)}`], ["GPS distance", `${trip.distanceMiles.toFixed(1)} mi`], ["Estimated stops", String(trip.stops.length)], ["Location updates", String(trip.segments.flat().length)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-black uppercase text-slate-500">{label}</dt><dd className="mt-1 font-black">{value}</dd></div>)}
    </dl>
    <DriverTripMap key={trip.id} trip={trip} />
    <p className="mt-3 text-sm font-semibold text-slate-600">Blue: recorded GPS trail · Green: start · Red: latest location · Numbered markers: estimated stops.</p>
    <p className="mt-2 text-xs font-semibold text-slate-500">Stops require at least 2 minutes within about 60 meters. Times are Eastern. GPS distance is approximate; missing updates leave breaks in the route.</p>
    {trip.gapCount > 0 ? <p className="mt-2 text-sm font-bold text-amber-800">{trip.gapCount} gaps in this route. Travel and stop time during these gaps are unknown.</p> : null}
    {omittedPoints > 0 ? <p className="mt-2 text-sm font-bold text-amber-800">{omittedPoints} inaccurate location updates were omitted from this day.</p> : null}
    <h3 className="mt-6 text-xl font-black">Stops</h3>
    {trip.stops.length === 0 ? <p className="mt-2 text-sm font-semibold text-slate-600">No stops of at least 2 minutes were recorded on this trip.</p> :
      <ol className="mt-3 grid gap-3">{trip.stops.map((stop, index) => <li key={stop.arrivedAt} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black">Stop {index + 1} · {Math.round(stop.durationSeconds / 60)} minutes</h4>
          <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`} className="text-sm font-black text-sky-700 underline">Open stop location</a></div>
        <p className="mt-2 text-sm font-bold text-slate-600">Arrived {time(stop.arrivedAt)} · {stop.departedAt ? `Departed around ${time(stop.departedAt)}` : stop.ongoing ? `Still stopped at last update (${time(stop.lastObservedAt)})` : `Last observed ${time(stop.lastObservedAt)}; departure not recorded`}</p>
      </li>)}</ol>}
  </section>;
}
