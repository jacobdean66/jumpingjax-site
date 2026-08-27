"use client";

import { useState } from "react";

type Result = {
  submissionsReviewed: number;
  issuesFound: number;
  created: number;
  reused: number;
  aiInvocations: 0;
};

export function WaiverTriageClient() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agents/waiver-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json() as { ok: boolean; result?: Result; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Read-only waiver triage failed safely.");
      const result = body.result;
      setMessage(`${result.submissionsReviewed} submissions reviewed · ${result.issuesFound} issues · ${result.created} new jobs · ${result.reused} deduplicated · AI calls ${result.aiInvocations}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Read-only waiver triage failed safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-teal-200 bg-white p-4">
      <button disabled={busy} onClick={run} className="rounded-full bg-teal-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
        {busy ? "Reviewing…" : "Run read-only waiver triage"}
      </button>
      {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </div>
  );
}
