"use client";
import { useState } from "react";
import { SIGNATURE_ACKNOWLEDGMENT, validSignerName } from "@/lib/rental-agreements/types";
export function AgreementSignForm({ token }: { token: string }) {
  const [name, setName] = useState(""); const [accepted, setAccepted] = useState(false);
  const [working, setWorking] = useState(false); const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setWorking(true); setMessage("");
    try {
      const res = await fetch(`/api/rental-agreement/${encodeURIComponent(token)}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, acknowledged: accepted }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to sign the agreement.");
      window.location.reload();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to sign the agreement."); }
    finally { setWorking(false); }
  }
  return <form onSubmit={submit} className="mx-auto mt-5 max-w-4xl rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-slate-950 print:hidden">
    <h2 className="text-xl font-black">Sign your rental agreement</h2>
    <label className="mt-4 flex items-start gap-3 text-sm font-semibold"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span>{SIGNATURE_ACKNOWLEDGMENT}</span></label>
    <label className="mt-5 block text-sm font-bold">Type your full legal name to sign<input required autoComplete="name" minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base" /></label>
    <button disabled={working || !accepted || !validSignerName(name)} className="mt-4 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{working ? "Signing…" : "Sign agreement"}</button>
    {message ? <p className="mt-3 text-sm text-rose-800" role="alert">{message}</p> : null}
  </form>;
}
