"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RentalCalendarRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => { if (!document.hidden) router.refresh(); }, 30_000);
    return () => clearInterval(timer);
  }, [enabled, router]);
  return null;
}
