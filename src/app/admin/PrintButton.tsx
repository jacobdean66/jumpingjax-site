"use client";

import { notifyInvitationAgent } from "@/lib/facility-parties/invitations/agent-client";

export function PrintButton({
  label,
  invitation,
}: {
  label: string;
  invitation?: {
    sourceText: string;
    optionIndex?: number;
    alternatesUsed?: number;
    bookingId?: string;
  };
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
      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
    >
      {label}
    </button>
  );
}
