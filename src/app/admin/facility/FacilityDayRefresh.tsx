"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { facilityAdminDay, facilityAdminNextMidnight } from "@/lib/admin/facility-admin-date";

export function FacilityDayRefresh({ today }: { today: string }) {
  const router = useRouter();
  useEffect(() => {
    const refreshIfNewDay = () => {
      if (facilityAdminDay() !== today) router.refresh();
    };
    refreshIfNewDay();
    const timer = window.setTimeout(refreshIfNewDay, Math.max(0, Date.parse(facilityAdminNextMidnight()) - Date.now()) + 100);
    const onVisible = () => { if (document.visibilityState === "visible") refreshIfNewDay(); };
    window.addEventListener("focus", refreshIfNewDay);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshIfNewDay);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, today]);
  return null;
}
