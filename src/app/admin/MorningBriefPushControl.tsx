"use client";

import { useEffect, useState } from "react";

function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function MorningBriefPushControl() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Checking notification support…");

  useEffect(() => {
    void Promise.resolve().then(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        setMessage("On iPhone, add this site to the Home Screen first. Then reopen it here.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setStatus(subscription ? "enabled" : "ready");
      setMessage(subscription ? "Morning notifications are enabled on this phone." : "Get a phone notification when the weekday brief is ready.");
    });
  }, []);

  async function enable() {
    setStatus("loading");
    setMessage("Requesting notification permission…");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const configResponse = await fetch("/api/admin/morning-brief/push", { cache: "no-store" });
      const config = await configResponse.json() as { publicKey?: string; configured?: boolean };
      if (!configResponse.ok || !config.configured || !config.publicKey) throw new Error("Morning notifications are not configured yet.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(config.publicKey),
      });
      const response = await fetch("/api/admin/morning-brief/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error("The phone could not be subscribed.");
      setStatus("enabled");
      setMessage("Morning notifications are enabled on this phone.");
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Notifications could not be enabled.");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-sky-900">Phone notification</p>
      <p className="mt-1 text-xs font-semibold text-slate-700">{message}</p>
      {status === "ready" ? (
        <button type="button" onClick={enable} className="mt-3 rounded-full bg-sky-700 px-4 py-2 text-xs font-black text-white hover:bg-sky-800">
          Enable morning notifications
        </button>
      ) : null}
    </div>
  );
}
