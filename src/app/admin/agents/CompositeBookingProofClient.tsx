"use client";

import { useState } from "react";

type Result = {
  ready: number;
  safelyBlocked: number;
  aiInvocations: 0;
  productionWrites: 0;
  scenarios: Array<{ name: string; status: string }>;
};

export function CompositeBookingProofClient() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agents/composite-booking-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json() as { ok: boolean; result?: Result; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Booking proof failed safely.");
      const result = body.result;
      setMessage(`${result.scenarios.length} scenarios · ${result.ready} ready for owner review · ${result.safelyBlocked} safely blocked · AI calls ${result.aiInvocations} · production writes ${result.productionWrites}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Booking proof failed safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4">
      <p className="text-sm font-black text-slate-900">Composite booking proof</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">Rentals, facility parties, foam parties, combinations, conflicts, corrections, and cancellation. Simulation only.</p>
      <button disabled={busy} onClick={run} className="mt-3 rounded-full bg-indigo-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
        {busy ? "Testing…" : "Run safe booking proof"}
      </button>
      {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </div>
  );
}
