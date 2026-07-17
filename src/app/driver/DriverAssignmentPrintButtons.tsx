"use client";

import { PrintButton } from "@/app/admin/PrintButton";

type Assignment = {
  truck: string;
  truckLabel: string;
  load: number | null;
  stopCount: number;
};

export function DriverAssignmentPrintButtons({
  assignments,
}: {
  assignments: Assignment[];
}) {
  if (assignments.length === 0) return null;

  return (
    <div className="driver-screen-only mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        Print driver sheets
      </p>
      <p className="text-sm font-semibold text-slate-600">
        Each truck / trailer load prints on its own page. Use Print All Sheets for a
        batch, or print one assignment at a time.
      </p>
      <div className="flex flex-wrap gap-2">
        <PrintButton label="Print All Sheets" />
        {assignments.map((assignment) => (
          <button
            key={`${assignment.truck}-${assignment.load}`}
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-800"
            onClick={() => {
              const id = `driver-sheet-${assignment.truck}-load-${assignment.load}`;
              document.querySelectorAll(".driver-print-sheet").forEach((node) => {
                node.classList.add("driver-print-sheet-skip");
              });
              document.getElementById(id)?.classList.remove("driver-print-sheet-skip");
              window.print();
              document.querySelectorAll(".driver-print-sheet").forEach((node) => {
                node.classList.remove("driver-print-sheet-skip");
              });
            }}
          >
            Print {assignment.truckLabel} / Load{" "}
            {assignment.load == null ? "Unassigned" : assignment.load} (
            {assignment.stopCount})
          </button>
        ))}
      </div>
    </div>
  );
}
