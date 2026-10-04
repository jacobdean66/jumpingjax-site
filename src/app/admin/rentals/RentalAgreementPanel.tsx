"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signerNameMatches, type RentalAgreement } from "@/lib/rental-agreements/types";

type History = RentalAgreement & { path: string };
export function RentalAgreementPanel({ bookingId, customerName, customerEmail, history, editable }: {
  bookingId: string; customerName: string; customerEmail: string | null; history: History[]; editable: boolean;
}) {
  const router = useRouter(); const latest = history[0];
  const [editing, setEditing] = useState(false); const [terms, setTerms] = useState(""); const [extra, setExtra] = useState("");
  const [working, setWorking] = useState(false); const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  const endpoint = `/api/admin/rentals/${encodeURIComponent(bookingId)}/agreement`;
  const mismatch = latest?.status === "signed" && !signerNameMatches(customerName, latest.signer_legal_name);
  const label = !latest ? "Not signed" : latest.status === "superseded" ? "Needs new signature" : latest.status === "awaiting_signature" ? "Awaiting signature" : mismatch && !latest.reviewed_at ? "Needs name review" : "Signed";
  async function edit() {
    setWorking(true); setMessage("");
    try {
      const res = await fetch(endpoint, { cache: "no-store" }); const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load the agreement.");
      setTerms(latest?.snapshot.terms ?? data.snapshot.terms); setExtra(latest?.snapshot.additionalTerms ?? "");
      requestId.current = null; setEditing(true);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to load the agreement."); }
    finally { setWorking(false); }
  }
  async function act(action: string, agreementId?: string) {
    setWorking(true); setMessage(""); requestId.current ??= crypto.randomUUID();
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, agreementId, requestId: requestId.current, terms, additionalTerms: extra }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "The agreement action failed.");
      setMessage(data.message); requestId.current = null; setEditing(false); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "The agreement action failed."); }
    finally { setWorking(false); }
  }
  const button = "min-h-10 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-950 hover:bg-slate-100 disabled:opacity-50";
  return <section className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black text-slate-950">Rental agreement</h3><span className={`rounded-full px-3 py-1 text-xs font-black ${label === "Signed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{label}</span></div>
    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs font-bold text-slate-500">Booking customer</dt><dd className="font-bold">{customerName}</dd></div><div><dt className="text-xs font-bold text-slate-500">{latest?.status === "superseded" ? "Previous signer" : "Signed name"}</dt><dd className="font-bold">{latest?.signer_legal_name ?? "Not signed yet"}</dd></div></dl>
    {latest?.signed_at ? <p className="mt-2 text-xs text-slate-600">Signed {new Date(latest.signed_at).toLocaleString("en-US", { timeZone: "America/New_York" })} (Eastern) · v{latest.version}</p> : null}
    {mismatch ? <p className="mt-3 rounded-xl bg-amber-100 p-3 text-xs font-bold text-amber-950">The signed name differs from the booking customer. Check the name with the customer, record your review, or request a corrected signature.</p> : null}
    {latest?.reviewed_at ? <p className="mt-2 text-xs text-slate-600">Name reviewed by {latest.reviewed_by} on {new Date(latest.reviewed_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}.</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      {latest ? <a href={latest.path} target="_blank" rel="noreferrer" className={button}>{latest.signed_at ? "View / print signed agreement" : "View agreement"}</a> : null}
      {latest?.signed_at && customerEmail ? <button disabled={working} onClick={() => act("email_signed", latest.id)} className={button}>Email signed agreement</button> : null}
      {latest?.status === "awaiting_signature" && customerEmail && editable ? <button disabled={working} onClick={() => act("email_signing", latest.id)} className={button}>Email signing link</button> : null}
      {mismatch && !latest?.reviewed_at ? <button disabled={working} onClick={() => act("review_name", latest.id)} className={button}>Mark name reviewed</button> : null}
      {editable ? <button disabled={working} onClick={edit} className={button}>{latest ? "Edit / request new signature" : "Create agreement"}</button> : null}
    </div>
    {latest?.last_emailed_at ? <p className="mt-3 text-xs text-slate-600">Email {latest.email_status === "failed" ? "failed" : "sent"} · {new Date(latest.last_emailed_at).toLocaleString("en-US", { timeZone: "America/New_York" })} (Eastern)</p> : null}
    {editing ? <div className="mt-5 space-y-4 rounded-xl bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">Saving creates a new agreement with the current rental details. The customer must sign the new version. Previous signed copies stay in the history.</p>
      <label className="block text-sm font-bold">Agreement terms<textarea rows={12} maxLength={20000} value={terms} onChange={e => { setTerms(e.target.value); requestId.current = null; }} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal leading-relaxed" /></label>
      <label className="block text-sm font-bold">Additional terms for this rental<textarea rows={3} maxLength={10000} value={extra} onChange={e => { setExtra(e.target.value); requestId.current = null; }} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>
      <div className="flex flex-wrap gap-2"><button disabled={working || terms.trim().length < 20} onClick={() => act("create")} className="rounded-full bg-cyan-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{working ? "Saving…" : "Save new agreement version"}</button><button disabled={working} onClick={() => setEditing(false)} className={button}>Close</button></div>
    </div> : null}
    {message ? <p className="mt-3 text-sm font-semibold" role="status">{message}</p> : null}
    {history.length > 1 ? <details className="mt-4"><summary className="cursor-pointer text-xs font-bold text-slate-600">Agreement history ({history.length} versions)</summary><ul className="mt-2 space-y-2">{history.map(a => <li key={a.id}><a href={a.path} target="_blank" rel="noreferrer" className="text-xs font-semibold text-cyan-800 underline">v{a.version} · {a.status.replaceAll("_", " ")} {a.signer_legal_name ? `· ${a.signer_legal_name}` : ""}</a></li>)}</ul></details> : null}
  </section>;
}
