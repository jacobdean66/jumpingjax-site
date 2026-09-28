"use client";

import { useRef, useState } from "react";
import { readInvitationDownload } from "@/lib/facility-parties/invitations/download";

export function InvitationDownloadButton({ bookingId, label = "Download the invitation", className }: {
  bookingId: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "preparing" | "started" | "error">("idle");
  const inFlight = useRef(false);

  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("preparing");
    try {
      const response = await fetch(`/api/facility/invitations/${encodeURIComponent(bookingId)}/editable`, {
        cache: "no-store", signal: AbortSignal.timeout(60_000),
      });
      const { file, fileName } = await readInvitationDownload(response);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      try { link.click(); } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setState("started");
    } catch {
      setState("error");
    } finally { inFlight.current = false; }
  }

  return <div>
    <button type="button" onClick={() => void download()} disabled={state === "preparing"} aria-busy={state === "preparing"} className={className}>
      {state === "preparing" ? "Preparing your download…" : state === "error" ? "Try downloading again" : label}
    </button>
    <p role={state === "error" ? "alert" : "status"} className="mt-2 max-w-sm text-sm">
      {state === "error" ? "We couldn’t prepare your file. Please try again. Your booking is saved." : state === "started" ? "Your file is ready. Check your browser’s downloads, or tap download again." : ""}
    </p>
  </div>;
}
