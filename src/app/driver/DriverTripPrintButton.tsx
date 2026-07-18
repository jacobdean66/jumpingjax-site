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
        const tripSheets = Array.from(
          document.querySelectorAll<HTMLElement>(".driver-trip-print-sheet"),
        );
        const assignmentSheets = Array.from(
          document.querySelectorAll<HTMLElement>(".driver-print-sheet"),
        );
        const allIds = tripSheets.map((sheet) => sheet.id);
        if (sheetId && !allIds.includes(sheetId)) return;

        const skipped = new Set(tripSheetIdsToSkip(allIds, sheetId));
        const cleanup = () => {
          // Restore default: trip sheets stay skipped so desktop Print All
          // and assignment-only print never include them.
          tripSheets.forEach((sheet) =>
            sheet.classList.add("driver-print-sheet-skip"),
          );
          assignmentSheets.forEach((sheet) =>
            sheet.classList.remove("driver-print-sheet-skip"),
          );
          window.removeEventListener("afterprint", cleanup);
        };

        tripSheets.forEach((sheet) => {
          sheet.classList.toggle(
            "driver-print-sheet-skip",
            skipped.has(sheet.id),
          );
        });
        // Hide load-based assignment sheets when printing a single trip.
        assignmentSheets.forEach((node) =>
          node.classList.add("driver-print-sheet-skip"),
        );

        window.addEventListener("afterprint", cleanup, { once: true });
        window.print();
        cleanup();
      }}
    >
      {label}
    </button>
  );
}
