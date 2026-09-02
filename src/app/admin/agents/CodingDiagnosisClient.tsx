"use client";

import { useState } from "react";

type Result = {
  summary: string;
  deduplicated: boolean;
  criticalIssues: number;
  warnings: number;
  unhealthyRoutes: number;
  aiInvocations: 0;
  codeWrites: 0;
  deployments: 0;
};

export function CodingDiagnosisClient() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agents/coding-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json() as { ok: boolean; result?: Result; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Coding diagnosis failed safely.");
      setMessage(`${body.result.summary} ${body.result.deduplicated ? "Existing identical result reused." : "New durable result recorded."}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Coding diagnosis failed safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-7 rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-indigo-700">Connected specialist</p>
      <h2 className="mt-1 text-2xl font-black">Coding Agent</h2>
      <p className="mt-1 text-sm font-semibold text-slate-700">
        Read-only diagnosis of the deployed website, agent failures, and code-security provider state. Fixes and deployments remain separately reviewed.
      </p>
      <button disabled={busy} onClick={run} className="mt-4 rounded-full bg-indigo-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
        {busy ? "Diagnosing…" : "Run read-only code diagnosis"}
      </button>
      {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </section>
  );
}
