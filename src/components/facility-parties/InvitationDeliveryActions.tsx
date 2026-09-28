"use client";

import { useState } from "react";
import { InvitationDownloadButton } from "./InvitationDownloadButton";

export function InvitationDeliveryActions({ bookingId, requestKey }: { bookingId: string; requestKey: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function emailLink() {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    try {
      const response = await fetch(`/api/facility/invitations/${encodeURIComponent(bookingId)}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestKey }),
      });
      if (!response.ok) throw new Error("Email unavailable");
      setState("sent");
    } catch { setState("error"); }
  }

  return <section className="mt-6 rounded-2xl border border-cyan-300/40 bg-cyan-950/40 p-4" aria-label="Get your invitations">
    <h3 className="text-xl font-black text-white">Your invitations are ready</h3>
    <p className="mt-2 text-sm text-slate-200">How would you like to get them? You can use either option, or both.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => void emailLink()} disabled={state === "sending" || state === "sent"} className="min-h-12 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
        {state === "sending" ? "Sending your link…" : state === "sent" ? "Invitation link emailed" : "Email me the invitation link"}
      </button>
      <InvitationDownloadButton bookingId={bookingId} className="min-h-12 w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950 disabled:opacity-60" />
    </div>
    <p role={state === "error" ? "alert" : "status"} className="mt-3 text-sm text-slate-200">
      {state === "sent" ? "Sent to the email address on your booking." : state === "error" ? "We couldn’t email your link. Please try again, or download your invitation now." : "The download is an editable PowerPoint file with your party’s QR code on every invitation."}
    </p>
    <a href={`/facility-parties/invitations/${encodeURIComponent(bookingId)}`} className="mt-2 inline-block text-sm font-bold text-cyan-200 underline">View and share your invitation</a>
    <p className="mt-3 text-xs text-slate-300">Your party date is still pending approval from Jumping Jax. Guests can RSVP after your party is approved.</p>
  </section>;
}
