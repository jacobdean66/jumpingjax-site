"use client";

import { useState } from "react";

type Result = {
  intentsReviewed: number;
  followUpsDue: number;
  created: number;
  reused: number;
  customerMessages: 0;
  bookingWrites: 0;
  externalCalendarWrites: 0;
  paymentWrites: 0;
  aiInvocations: 0;
};

export function BookingFollowUpClient() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agents/booking-follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json() as { ok: boolean; result?: Result; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Follow-up review failed safely.");
      const result = body.result;
      setMessage(`${result.intentsReviewed} intents reviewed · ${result.followUpsDue} follow-ups due · ${result.created} new jobs · ${result.reused} deduplicated · customer messages ${result.customerMessages} · booking/calendar/payment writes ${result.bookingWrites + result.externalCalendarWrites + result.paymentWrites} · AI calls ${result.aiInvocations}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Follow-up review failed safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-4">
      <p className="mb-3 text-sm font-bold text-slate-700">Owner-review reminders only. This scan never contacts customers or changes bookings, calendars, or payments.</p>
      <button disabled={busy} onClick={run} className="rounded-full bg-violet-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
        {busy ? "Reviewing…" : "Run follow-up review"}
      </button>
      {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </div>
  );
}
