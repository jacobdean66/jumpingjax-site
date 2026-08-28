"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AgreementSignForm({ token }: { token: string }) {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function sign() {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/facility-party-agreement/${encodeURIComponent(token)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalName, accepted }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message ?? "Unable to sign the agreement.");
      setMessage("Your agreement has been signed. Thank you!");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign the agreement.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-4xl rounded-3xl border-2 border-cyan-300 bg-cyan-50 p-6 shadow-lg print:hidden">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-800">Electronic signature</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">Review and accept your agreement</h2>
      <p className="mt-2 text-sm font-semibold text-slate-700">Typing your legal name and selecting the checkbox creates your electronic signature.</p>
      <label className="mt-5 block text-xs font-black uppercase text-slate-600">Full legal name
        <input autoComplete="name" value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950" />
      </label>
      <label className="mt-4 flex items-start gap-3 rounded-xl bg-white p-4 text-sm font-semibold text-slate-800">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-cyan-600" />
        <span>I have reviewed this agreement and payment receipt, agree to the listed terms, and intend my typed legal name to be my electronic signature.</span>
      </label>
      <button type="button" onClick={sign} disabled={working || !accepted || legalName.trim().length < 2} className="mt-5 rounded-full bg-cyan-600 px-6 py-3 text-sm font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
        {working ? "Signing…" : "Sign agreement"}
      </button>
      {message ? <p className="mt-3 text-sm font-bold text-slate-800" role="status">{message}</p> : null}
    </section>
  );
}
