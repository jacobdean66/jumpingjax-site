"use client";

import { useState } from "react";
import { tripSheetIdsToSkip } from "@/lib/admin/driver-trip-sheet-print";

export function DriverTripSheetPrintButton({
  allPageIds,
  targetPageId,
  label,
}: {
  allPageIds: string[];
  targetPageId?: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);

  const onPrint = () => {
    if (busy) return;
    setBusy(true);
    const skipIds = tripSheetIdsToSkip(allPageIds, targetPageId);
    for (const id of skipIds) {
      document.getElementById(id)?.classList.add("driver-print-sheet-skip");
    }
    const cleanup = () => {
      for (const id of skipIds) {
        document.getElementById(id)?.classList.remove("driver-print-sheet-skip");
      }
      setBusy(false);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 2500);
  };

  return (
    <button
      type="button"
      onClick={onPrint}
      disabled={busy}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? "Printing…" : label}
    </button>
  );
}
