"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DriverMobileLocationSnapshot } from "@/lib/admin/driver-location";

type ApiResponse =
  | { ok: true; locations: DriverMobileLocationSnapshot[] }
  | { ok: false; error?: string };

function formatTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function minutesAgo(value: string | null): string {
  if (!value) return "No location yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes === 0) return "Just now";
  if (minutes === 1) return "1 minute ago";
  return `${minutes} minutes ago`;
}

function formatBattery(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Unknown";
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatSpeed(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Unknown";
  const milesPerHour = value * 2.236936;
  return `${Math.round(milesPerHour)} mph`;
}

function mapUrl(location: DriverMobileLocationSnapshot): string | null {
  if (location.latitude == null || location.longitude == null) return null;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${location.latitude},${location.longitude}`);
  return url.toString();
}

function statusClasses(status: DriverMobileLocationSnapshot["status"]): string {
  if (status === "active") return "border-emerald-200 bg-emerald-100 text-emerald-950";
  if (status === "stale") return "border-amber-200 bg-amber-100 text-amber-950";
  if (status === "signed-out") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-rose-200 bg-rose-100 text-rose-950";
}

function statusLabel(status: DriverMobileLocationSnapshot["status"]): string {
  if (status === "active") return "Active";
  if (status === "stale") return "Stale";
  if (status === "signed-out") return "Signed out";
  return "No location";
}

export function DriverLocationsClient({
  initialLocations,
}: {
  initialLocations: DriverMobileLocationSnapshot[];
}) {
  const [locations, setLocations] = useState(initialLocations);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const activeCount = useMemo(
    () => locations.filter((location) => location.status === "active").length,
    [locations],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/driver-locations", {
        cache: "no-store",
      });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok || !body.ok) {
        setError(
          !body.ok && body.error
            ? body.error
            : "Unable to refresh driver locations",
        );
        return;
      }
      setLocations(body.locations);
      setLastRefreshedAt(new Date());
      setError(null);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh driver locations",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <section className="mt-6 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Active
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Sessions
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">{locations.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Refresh
          </p>
          <p className="mt-2 text-sm font-black text-slate-950">
            {lastRefreshedAt ? formatTime(lastRefreshedAt.toISOString()) : "Every 30 seconds"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-600">
          Locations update automatically while the driver app is signed in and
          background location is allowed.
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh Now"}
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-950">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {locations.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-950">
              No shared driver locations yet.
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Locations appear after a driver shares location on the website or signs into the installed Driver App.
            </p>
          </div>
        ) : (
          locations.map((location) => {
            const href = mapUrl(location);
            return (
              <article
                key={location.sessionId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black text-slate-950">
                        {location.driverName}
                      </h2>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClasses(location.status)}`}
                      >
                        {statusLabel(location.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      {location.deviceLabel ?? "Driver phone"} · started{" "}
                      {formatTime(location.startedAt)}
                    </p>
                  </div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-white hover:bg-sky-600"
                    >
                      Open Map
                    </a>
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs font-black uppercase text-slate-500">
                      Last seen
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {minutesAgo(location.receivedAt)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs font-black uppercase text-slate-500">
                      Accuracy
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {location.accuracyMeters == null
                        ? "Unknown"
                        : `${Math.round(location.accuracyMeters)} m`}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs font-black uppercase text-slate-500">
                      Speed
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatSpeed(location.speedMetersPerSecond)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs font-black uppercase text-slate-500">
                      Battery
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatBattery(location.batteryLevel)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs font-black uppercase text-slate-500">
                      Latitude
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {location.latitude == null ? "Unknown" : location.latitude.toFixed(5)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs font-black uppercase text-slate-500">
                      Longitude
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {location.longitude == null ? "Unknown" : location.longitude.toFixed(5)}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
