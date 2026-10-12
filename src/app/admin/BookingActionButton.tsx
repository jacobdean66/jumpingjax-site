"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type BookingActionButtonProps = {
  action: "confirm" | "reject";
  endpoint: string;
  label: string;
  tone: "confirm" | "reject";
  workingLabel?: string;
  successMessage?: string;
  refreshOnly?: boolean;
};

export function BookingActionButton({
  action,
  endpoint,
  label,
  tone,
  workingLabel,
  successMessage,
  refreshOnly = false,
}: BookingActionButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitAction() {
    if (isWorking) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
      });
      const text = await response.text();

      if (!response.ok) {
        let failure: { message?: string; error?: string; statusChanged?: boolean } = {};
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) failure = parsed;
        } catch { /* Plain-text API errors are supported too. */ }
        setMessage(failure.message || failure.error || text || "Something went wrong. Try again.");
        if (failure.statusChanged === true) router.refresh();
        setIsWorking(false);
        return;
      }

      setMessage(
        (successMessage ? text || successMessage : null) ?? (action === "reject"
          ? "Rejected"
          : label.toLowerCase().includes("calendar")
            ? text || "Calendar sync complete"
            : "Confirmed"),
      );
      const nextParams = new URLSearchParams(searchParams.toString());
      const currentStatus = nextParams.get("status");
      if (!refreshOnly && (!currentStatus || currentStatus === "all")) {
        nextParams.set("status", "pending");
        router.replace(`${pathname}?${nextParams.toString()}`);
      }
      router.refresh();
    } catch {
      setMessage("Could not reach the server. Try again.");
    } finally {
      setIsWorking(false);
    }
  }

  const classes =
    tone === "confirm"
      ? "rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white hover:bg-emerald-600 disabled:cursor-wait disabled:bg-emerald-300"
      : "rounded-full bg-rose-500 px-4 py-2 text-xs font-black text-white hover:bg-rose-600 disabled:cursor-wait disabled:bg-rose-300";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={submitAction}
        disabled={isWorking}
        className={classes}
      >
        {isWorking ? (workingLabel ?? `${label}ing...`) : label}
      </button>
      {message && (
        <span className="max-w-40 text-xs font-bold text-slate-600">
          {message}
        </span>
      )}
    </span>
  );
}
