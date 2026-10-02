"use client";
import { useState } from "react";
import { RentalAgreementDocument } from "./RentalAgreementDocument";
import { SIGNATURE_ACKNOWLEDGMENT, validSignerName, type RentalAgreementSnapshot } from "@/lib/rental-agreements/types";

export type CheckoutAgreement = { requestFingerprint: string; previewToken: string; signerName: string; acknowledged: boolean };
export function RentalAgreementCheckout({ payload, requestFingerprint, enabled, onChange }: {
  payload: Record<string, unknown>; requestFingerprint: string; enabled: boolean; onChange: (value: CheckoutAgreement | null) => void;
}) {
  const [preview, setPreview] = useState<{ snapshot: RentalAgreementSnapshot; previewToken: string } | null>(null);
  const [name, setName] = useState(""); const [accepted, setAccepted] = useState(false);
  const [working, setWorking] = useState(false); const [error, setError] = useState("");
  async function review() {
    setWorking(true); setError(""); onChange(null); setPreview(null); setAccepted(false); setName("");
    try {
      const res = await fetch("/api/rental-agreement/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load the agreement.");
      setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load the agreement."); }
    finally { setWorking(false); }
  }
  function update(nextName: string, nextAccepted: boolean) {
    setName(nextName); setAccepted(nextAccepted);
    onChange(preview && nextAccepted && validSignerName(nextName) ? { requestFingerprint, previewToken: preview.previewToken, signerName: nextName.trim(), acknowledged: nextAccepted } : null);
  }
  return <section className="mt-8 rounded-2xl border border-cyan-400/40 bg-cyan-400/5 p-4 sm:p-6" aria-labelledby="rental-agreement-heading">
    <p className="text-xs font-black uppercase tracking-wider text-cyan-300">Required before submitting</p>
    <h2 id="rental-agreement-heading" className="mt-2 text-xl font-black text-white">Review and sign your rental agreement</h2>
    <p className="mt-2 text-sm text-slate-300">Your booking details will be filled in for you. Typing your full legal name below signs the agreement when you submit your rental request.</p>
    {!preview ? <button type="button" disabled={!enabled || working} onClick={review} className="mt-4 min-h-12 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{working ? "Loading agreement…" : "Review rental agreement"}</button> : null}
    {!enabled ? <p className="mt-3 text-sm text-slate-400">Complete your rental and customer details above to review the agreement.</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
    {preview ? <div className="mt-5">
      <RentalAgreementDocument snapshot={preview.snapshot} />
      <label className="mt-5 flex items-start gap-3 text-sm font-semibold text-white"><input type="checkbox" checked={accepted} onChange={e => update(name, e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-cyan-400" /><span>{SIGNATURE_ACKNOWLEDGMENT}</span></label>
      <label className="mt-5 block text-sm font-bold text-white">Type your full legal name to sign<input autoComplete="name" maxLength={120} value={name} onChange={e => update(e.target.value, accepted)} placeholder="Full legal name" className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-950 px-4 py-3 text-base text-white" /></label>
      <p className="mt-3 text-xs text-slate-300">Changing your booking details requires reviewing the updated agreement again.</p>
      <button type="button" onClick={review} disabled={working} className="mt-3 text-sm font-bold text-cyan-300 underline">Refresh agreement</button>
    </div> : null}
  </section>;
}
