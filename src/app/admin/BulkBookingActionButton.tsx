"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BulkBookingActionButtonProps = {
  endpoints: string[];
  label: string;
  doneLabel?: string;
};

export function BulkBookingActionButton({
  endpoints,
  label,
  doneLabel = "Approved",
}: BulkBookingActionButtonProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitAll() {
    if (isWorking || endpoints.length === 0) return;
    const confirmed = window.confirm(
      `Approve all ${endpoints.length} pending booking${endpoints.length === 1 ? "" : "s"} shown here?`,
    );
    if (!confirmed) return;

    setIsWorking(true);
    setMessage(null);

    let approved = 0;
    try {
      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: "POST",
          cache: "no-store",
        });
        if (!response.ok) {
          const text = await response.text();
          setMessage(
            `${approved} approved, then stopped: ${text || "server error"}`,
          );
          return;
        }
        approved += 1;
        setMessage(`Approved ${approved} of ${endpoints.length}`);
      }

      setMessage(`${doneLabel} ${approved}`);
      router.refresh();
    } catch {
      setMessage(`${approved} approved, then the connection dropped.`);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={submitAll}
        disabled={isWorking || endpoints.length === 0}
        className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-white hover:bg-emerald-600 disabled:cursor-wait disabled:bg-emerald-300"
      >
        {isWorking ? "Approving..." : label}
      </button>
      {message ? (
        <span className="max-w-72 text-xs font-bold text-slate-600">
          {message}
        </span>
      ) : null}
    </span>
  );
}
