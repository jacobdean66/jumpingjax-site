"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TrackerState = "idle" | "starting" | "tracking" | "blocked" | "error";

type Props = {
  truck: string | null;
  workDate: string;
};

const MIN_SEND_INTERVAL_MS = 45_000;
const STORAGE_PREFIX = "jumpingjax-driver-location-sharing";

function storageKey(truck: string | null, workDate: string) {
  return `${STORAGE_PREFIX}:${truck ?? "none"}:${workDate}`;
}

export function DriverLocationTracker({ truck, workDate }: Props) {
  const [state, setState] = useState<TrackerState>("idle");
  const [message, setMessage] = useState("Location sharing is off.");
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const key = useMemo(() => storageKey(truck, workDate), [truck, workDate]);

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
        truck,
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
  }, [key, stopWatch, truck, workDate]);

  const startTracking = useCallback((options: { remember: boolean }) => {
    if (!truck) {
      setState("blocked");
      setMessage("Choose a truck before sharing location.");
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
  }, [key, sendPosition, truck]);

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
    if (window.localStorage.getItem(key) === "on") {
      resumeTimer = window.setTimeout(() => startTracking({ remember: false }), 0);
    }
    return () => {
      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
      stopWatch();
    };
  }, [key, startTracking, stopWatch]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Driver location
          </p>
          <p className="mt-1 text-sm font-bold text-sky-950">{message}</p>
          <p className="mt-1 text-xs font-semibold text-sky-800">
            Owner-only route support. Customer pages do not receive these coordinates.
          </p>
        </div>
        <button
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
        </button>
      </div>
    </section>
  );
}
