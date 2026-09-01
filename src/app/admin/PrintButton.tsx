"use client";

import { useState } from "react";

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
  const [printBlocked, setPrintBlocked] = useState(false);
  const [edgePrintUrl, setEdgePrintUrl] = useState<string | null>(null);

  const button = (
    <button
      type="button"
      onClick={() => {
        if (invitation) {
          notifyInvitationAgent({
            action: "print",
            ...invitation,
          });
        }

        setPrintBlocked(false);
        setEdgePrintUrl(null);
        let printerDialogOpened = false;
        const markDialogOpened = () => {
          printerDialogOpened = true;
        };
        window.addEventListener("beforeprint", markDialogOpened, { once: true });
        window.print();
        window.setTimeout(() => {
          window.removeEventListener("beforeprint", markDialogOpened);
          if (!printerDialogOpened && choosePrinter) {
            setPrintBlocked(true);
            setEdgePrintUrl(`microsoft-edge:${window.location.href}`);
          }
        }, 700);
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

  if (!choosePrinter) return button;

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-2">
      {button}
      {printBlocked ? (
        <span
          role="status"
          className="max-w-md rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950"
        >
          This in-app browser blocked the printer window. Press Ctrl+P to choose a printer, or{" "}
          {edgePrintUrl ? (
            <a className="underline" href={edgePrintUrl}>
              open this sheet in Microsoft Edge
            </a>
          ) : null}
          . The invitation is already formatted for landscape.
        </span>
      ) : null}
    </span>
  );
}
