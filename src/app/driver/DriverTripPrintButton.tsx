"use client";

import { tripSheetIdsToSkip } from "@/lib/admin/driver-mobile";

export function DriverTripPrintButton({
  sheetId,
  label = "Print Trip Sheet",
  className,
}: {
  sheetId?: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={
        className ??
        "min-h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      }
      onClick={() => {
        const sheets = Array.from(
          document.querySelectorAll<HTMLElement>(".driver-trip-print-sheet"),
        );
        const allIds = sheets.map((sheet) => sheet.id);
        if (sheetId && !allIds.includes(sheetId)) return;

        const skipped = new Set(tripSheetIdsToSkip(allIds, sheetId));
        const cleanup = () => {
          sheets.forEach((sheet) =>
            sheet.classList.remove("driver-print-sheet-skip"),
          );
          window.removeEventListener("afterprint", cleanup);
        };

        sheets.forEach((sheet) => {
          sheet.classList.toggle(
            "driver-print-sheet-skip",
            skipped.has(sheet.id),
          );
        });
        // Also hide load-based assignment sheets when printing a single trip.
        document
          .querySelectorAll<HTMLElement>(".driver-print-sheet")
          .forEach((node) => node.classList.add("driver-print-sheet-skip"));

        window.addEventListener("afterprint", cleanup, { once: true });
        window.print();
        cleanup();
        document
          .querySelectorAll<HTMLElement>(".driver-print-sheet")
          .forEach((node) => node.classList.remove("driver-print-sheet-skip"));
      }}
    >
      {label}
    </button>
  );
}
