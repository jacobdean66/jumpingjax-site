"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function DriverAutoRefresh() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    const token = searchParams.get("token");
    const date = searchParams.get("date");
    if (token) params.set("token", token);
    if (date) params.set("date", date);

    const events = new EventSource(`/api/driver/events?${params.toString()}`);
    events.addEventListener("refresh", () => {
      router.refresh();
    });

    const fallback = window.setInterval(() => {
      router.refresh();
    }, 30_000);

    return () => {
      events.close();
      window.clearInterval(fallback);
    };
  }, [router, searchParams]);

  return null;
}
