"use client";

import { notifyInvitationAgent } from "@/lib/facility-parties/invitations/agent-client";

export function PrintButton({
  label,
  invitation,
  choosePrinter = false,
  orientation,
}: {
  label: string;
  invitation?: {
    sourceText: string;
    optionIndex?: number;
    alternatesUsed?: number;
    bookingId?: string;
  };
  choosePrinter?: boolean;
  orientation?: "portrait" | "landscape";
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (invitation) {
          notifyInvitationAgent({
            action: "print",
            ...invitation,
          });
        }
        window.print();
      }}
      aria-haspopup={choosePrinter ? "dialog" : undefined}
      title={
        choosePrinter
          ? `Open printer selection${orientation ? ` in ${orientation} layout` : ""}`
          : undefined
      }
      data-print-dialog={choosePrinter ? "printer-picker" : undefined}
      data-print-orientation={orientation}
      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
    >
      {label}
    </button>
  );
}
