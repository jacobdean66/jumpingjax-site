"use client";

import { useState } from "react";

type Result = {
  workflowsReviewed: number;
  issuesFound: number;
  created: number;
  reused: number;
  aiInvocations: 0;
};

export function BookingTriageClient() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agents/booking-triage", { method: "POST" });
      const body = await response.json() as { ok: boolean; result?: Result; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Read-only triage failed safely.");
      const result = body.result;
      setMessage(`${result.workflowsReviewed} workflows reviewed · ${result.issuesFound} issues · ${result.created} new jobs · ${result.reused} deduplicated · AI calls ${result.aiInvocations}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Read-only triage failed safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-4">
      <button disabled={busy} onClick={run} className="rounded-full bg-violet-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
        {busy ? "Reviewing…" : "Run read-only triage"}
      </button>
      {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </div>
  );
}
