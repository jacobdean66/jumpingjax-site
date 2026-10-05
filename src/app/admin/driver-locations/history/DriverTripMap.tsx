"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DriverTrip } from "@/lib/admin/driver-trip-history";

export default function DriverTripMap({ trip }: { trip: DriverTrip }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | undefined;
    const node = container.current;
    void import("leaflet").then((L) => {
      if (disposed || !node) return;
      map = L.map(node, { scrollWheelZoom: false, preferCanvas: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19,
      }).addTo(map);
      const points = trip.segments.flat();
      for (const segment of trip.segments) {
        if (segment.length > 1) L.polyline(segment.map((point) => [point.latitude, point.longitude]), { color: "#0284c7", weight: 5 }).addTo(map);
      }
      const label = (text: string) => { const node = document.createElement("span"); node.textContent = text; return node; };
      const first = points[0];
      const last = points[points.length - 1];
      if (first) L.circleMarker([first.latitude, first.longitude], { radius: 8, color: "#15803d", fillOpacity: 1 }).bindTooltip(label("Start")).addTo(map);
      if (last) L.circleMarker([last.latitude, last.longitude], { radius: 8, color: "#be123c", fillOpacity: 1 }).bindTooltip(label("Latest recorded location")).addTo(map);
      trip.stops.forEach((stop, index) => {
        const time = new Date(stop.arrivedAt).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
        L.circleMarker([stop.latitude, stop.longitude], { radius: 12, color: "#92400e", fillColor: "#fbbf24", fillOpacity: 1 })
          .bindTooltip(label(String(index + 1)), { permanent: true, direction: "center", className: "font-black" })
          .bindPopup(label(`Stop ${index + 1} · ${time} · ${Math.round(stop.durationSeconds / 60)} minutes`)).addTo(map!);
      });
      if (points.length) map.fitBounds(L.latLngBounds(points.map((point) => [point.latitude, point.longitude])), { padding: [35, 35], maxZoom: 16 });
      map.invalidateSize();
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; map?.remove(); };
  }, [trip]);
  return <div className="relative mt-4">
    {failed ? <p role="alert" className="rounded-xl bg-amber-50 p-4 font-bold text-amber-900">The map could not load. The recorded stop list is still available below.</p> : null}
    <div ref={container} role="region" aria-label={`Recorded route for ${trip.driverName}`} className="z-0 h-[420px] w-full rounded-2xl border border-slate-200 bg-slate-100" />
  </div>;
}
