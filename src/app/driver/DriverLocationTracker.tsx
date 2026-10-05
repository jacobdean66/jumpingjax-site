"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRIVER_VEHICLES, equipmentLabel, isDriverTrailer, isDriverVehicle } from "@/lib/admin/driver-trip-context";

type TrackerState = "idle" | "starting" | "tracking" | "blocked" | "error";

type Props = {
  truck: string | null;
  workDate: string;
  driverId: string;
  nativeTracking: boolean;
};

const MIN_SEND_INTERVAL_MS = 45_000;
const STORAGE_PREFIX = "jumpingjax-driver-location-sharing";

function storageKey(driverId: string, truck: string | null, workDate: string) {
  return `${STORAGE_PREFIX}:${driverId}:${truck ?? "none"}:${workDate}`;
}

export function DriverLocationTracker({ truck, workDate, driverId, nativeTracking }: Props) {
  const [vehicle, setVehicle] = useState("");
  const [trailer, setTrailer] = useState(truck ?? "");
  const [equipmentSaved, setEquipmentSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [equipmentMessage, setEquipmentMessage] = useState("Choose your truck and trailer, then save.");
  const [state, setState] = useState<TrackerState>("idle");
  const [message, setMessage] = useState("Location sharing is off.");
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const key = useMemo(() => storageKey(driverId, trailer, workDate), [driverId, trailer, workDate]);
  const equipmentKey = `jumpingjax-driver-equipment:${driverId}`;

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const sendPosition = useCallback(async (position: GeolocationPosition) => {
    const now = Date.now();
    if (now - lastSentAt.current < MIN_SEND_INTERVAL_MS) return;
    lastSentAt.current = now;

    const response = await fetch("/api/driver/location", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        truck: trailer,
        vehicle,
        workDate,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        speedMetersPerSecond: position.coords.speed,
        headingDegrees: position.coords.heading,
        capturedAt: new Date(position.timestamp).toISOString(),
      }),
    });

    if (response.status === 401) {
      window.localStorage.removeItem(key);
      stopWatch();
      setState("blocked");
      setMessage("Driver sign-in expired. Sign in again to share location.");
      return;
    }

    if (!response.ok) {
      setState("error");
      setMessage("Location could not be saved. Check signal and refresh if needed.");
      return;
    }

    setState("tracking");
    setMessage(`Sharing location. Last update ${new Date().toLocaleTimeString()}.`);
  }, [key, stopWatch, trailer, vehicle, workDate]);

  const startTracking = useCallback((options: { remember: boolean }) => {
    if (!equipmentSaved || !isDriverVehicle(vehicle) || !isDriverTrailer(trailer)) {
      setState("blocked");
      setMessage("Save your truck and trailer before sharing location.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setState("blocked");
      setMessage("This device does not support browser location sharing.");
      return;
    }
    if (watchId.current !== null) return;

    if (options.remember) {
      window.localStorage.setItem(key, "on");
    }
    setState("starting");
    setMessage("Requesting location permission...");
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        void sendPosition(position).catch(() => {
          setState("error");
          setMessage("Location could not be saved. Check signal and refresh if needed.");
        });
      },
      (error) => {
        setState(error.code === error.PERMISSION_DENIED ? "blocked" : "error");
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location permission is off for this browser."
            : "Location is unavailable right now.",
        );
      },
      {
        enableHighAccuracy: false,
        maximumAge: 30_000,
        timeout: 20_000,
      },
    );
  }, [key, sendPosition, equipmentSaved, vehicle, trailer]);

  const stopTracking = useCallback((options: { forget: boolean }) => {
    stopWatch();
    if (options.forget) {
      window.localStorage.removeItem(key);
    }
    setState("idle");
    setMessage("Location sharing is off.");
  }, [key, stopWatch]);

  useEffect(() => {
    let resumeTimer: number | null = null;
    if (!nativeTracking && equipmentSaved && window.localStorage.getItem(key) === "on") {
      resumeTimer = window.setTimeout(() => startTracking({ remember: false }), 0);
    }
    return () => {
      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
      stopWatch();
    };
  }, [key, startTracking, stopWatch, nativeTracking, equipmentSaved]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(equipmentKey) ?? "null");
        if (isDriverVehicle(stored?.vehicle)) setVehicle(stored.vehicle);
        if (!truck && isDriverTrailer(stored?.trailer)) setTrailer(stored.trailer);
        const selectedTrailer = truck || stored?.trailer;
        if (!nativeTracking && isDriverVehicle(stored?.vehicle) && isDriverTrailer(selectedTrailer) &&
          selectedTrailer === stored.trailer && window.localStorage.getItem(storageKey(driverId, selectedTrailer, workDate)) === "on") {
          setEquipmentSaved(true);
          setEquipmentMessage(`Saved: ${equipmentLabel(stored.vehicle, selectedTrailer)}.`);
        }
      } catch { /* A missing or stale selection should require a fresh save. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [equipmentKey, truck, driverId, workDate, nativeTracking]);

  async function saveEquipment() {
    if (!isDriverVehicle(vehicle) || !isDriverTrailer(trailer)) {
      setEquipmentMessage("Choose a truck and trailer first."); return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/driver/trip-context", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle, trailer }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) { setEquipmentMessage(body.error ?? "Truck and trailer could not be saved."); return; }
      const selection = { vehicle, trailer };
      window.localStorage.setItem(equipmentKey, JSON.stringify(selection));
      const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (message: string) => void } }).ReactNativeWebView;
      bridge?.postMessage(JSON.stringify({ type: "JAX_TRIP_CONTEXT", ...selection }));
      setEquipmentSaved(true);
      setEquipmentMessage(`Saved: ${equipmentLabel(vehicle, trailer)}.`);
    } catch { setEquipmentMessage("Could not save your truck and trailer. Try again."); }
    finally { setSaving(false); }
  }

  function changeEquipment(change: () => void) {
    stopTracking({ forget: true });
    change(); setEquipmentSaved(false);
    setEquipmentMessage("Save this selection before continuing your trip.");
  }

  useEffect(() => {
    function stopWhenSignedOut(event: StorageEvent) {
      if (event.key === key && event.newValue !== "on") {
        stopTracking({ forget: false });
      }
    }
    window.addEventListener("storage", stopWhenSignedOut);
    return () => window.removeEventListener("storage", stopWhenSignedOut);
  }, [key, stopTracking]);

  const tracking = state === "tracking" || state === "starting";

  return (
    <section className="driver-screen-only mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
      <h2 className="text-lg font-black text-sky-950">Your truck and trailer</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-sky-950">Truck
          <select value={vehicle} disabled={saving} onChange={(event) => changeEquipment(() => setVehicle(event.target.value))} className="mt-1 block min-h-12 w-full rounded-xl border border-sky-200 bg-white px-3 text-base">
            <option value="">Choose truck</option>
            {DRIVER_VEHICLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-sky-950">Trailer
          <select value={trailer} disabled={saving} onChange={(event) => changeEquipment(() => setTrailer(event.target.value))} className="mt-1 block min-h-12 w-full rounded-xl border border-sky-200 bg-white px-3 text-base">
            <option value="">Choose trailer</option><option value="truck-1">Short Trailer</option><option value="truck-2">Long Trailer</option>
          </select>
        </label>
      </div>
      <button type="button" onClick={saveEquipment} disabled={saving} className="mt-3 min-h-11 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save Truck & Trailer"}
      </button>
      <p role="status" className="my-3 text-sm font-bold text-sky-950">{equipmentMessage}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Driver location
          </p>
          <p className="mt-1 text-sm font-bold text-sky-950">{nativeTracking ? "The installed phone app records this trip while you are signed in. Sign out in the app to stop tracking." : message}</p>
          <p className="mt-1 text-xs font-semibold text-sky-800">
            Owner-only route support. Customer pages do not receive these coordinates.
          </p>
        </div>
        {!nativeTracking ? <button
          type="button"
          onClick={() =>
            tracking
              ? stopTracking({ forget: true })
              : startTracking({ remember: true })
          }
          className={`min-h-11 rounded-xl px-4 py-3 text-sm font-black ${
            tracking
              ? "bg-white text-sky-900 ring-1 ring-sky-200"
              : "bg-sky-600 text-white hover:bg-sky-700"
          }`}
        >
          {tracking ? "Stop sharing" : "Share location"}
        </button> : null}
      </div>
    </section>
  );
}
