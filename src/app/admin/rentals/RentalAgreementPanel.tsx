"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, FileSignature, Mail, Printer, Upload } from "lucide-react";
import { signerNameMatches, type RentalAgreement } from "@/lib/rental-agreements/types";
import { agreementState, agreementStateLabel, validAgreementEmail } from "@/lib/rental-agreements/workflow";

type History = RentalAgreement & { path: string };
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:border-cyan-500 hover:bg-cyan-50 disabled:opacity-50";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-900 disabled:opacity-50";
const eastern = (date: string) => new Date(date).toLocaleString("en-US", { timeZone: "America/New_York" });
const ymd = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function RentalAgreementPanel({ bookingId, customerName, customerEmail, history, editable }: {
  bookingId: string; customerName: string; customerEmail: string | null; history: History[]; editable: boolean;
}) {
  const router = useRouter(), latest = history[0], state = agreementState(customerName, latest);
  const mismatch = latest?.status === "signed" && !signerNameMatches(customerName, latest.signer_legal_name);
  const [editing, setEditing] = useState(false), [terms, setTerms] = useState(""), [extra, setExtra] = useState("");
  const [working, setWorking] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(false);
  const [sendReview, setSendReview] = useState<"signing" | "signed" | null>(null), [preparedPath, setPreparedPath] = useState<string | null>(null);
  const [paper, setPaper] = useState(false), [paperName, setPaperName] = useState(""), [signedOn, setSignedOn] = useState(() => ymd());
  const [file, setFile] = useState<File | null>(null), [copiedLink, setCopiedLink] = useState<string | null>(null);
  const requestId = useRef<string | null>(null), paperRequestId = useRef<string | null>(null);
  const endpoint = `/api/admin/rentals/${encodeURIComponent(bookingId)}/agreement`;
  const currentUnsigned = latest?.status === "awaiting_signature", needsPreparation = !latest || latest.status === "superseded";
  const sharePath = preparedPath ?? (latest?.status !== "superseded" ? latest?.path : null);
  function notify(text: string, failed = false) { setMessage(text); setError(failed); }
  async function act(action: string, agreementId?: string): Promise<{ path?: string; agreementId?: string; skipped?: boolean } | null> {
    setWorking(true); notify(""); requestId.current ??= crypto.randomUUID();
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, agreementId, requestId: requestId.current, terms, additionalTerms: extra, expectedEmail: customerEmail }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "The agreement action failed.");
      notify(data.message); requestId.current = null; setEditing(false); setSendReview(null);
      if (data.path) setPreparedPath(data.path);
      router.refresh(); return data;
    } catch (e) { notify(e instanceof Error ? e.message : "The agreement action failed.", true); return null; }
    finally { setWorking(false); }
  }
  async function edit() {
    setWorking(true); notify("");
    try {
      const res = await fetch(endpoint, { cache: "no-store" }), data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load the agreement.");
      setTerms(latest?.snapshot.terms ?? data.snapshot.terms); setExtra(latest?.snapshot.additionalTerms ?? "");
      requestId.current = null; setEditing(true); setSendReview(null);
    } catch (e) { notify(e instanceof Error ? e.message : "Unable to load the agreement.", true); }
    finally { setWorking(false); }
  }
  async function copyLink() {
    let path = sharePath;
    if (!path) path = (await act("prepare"))?.path;
    if (!path) return;
    const url = new URL(path, window.location.origin).toString(); setCopiedLink(url);
    try { await navigator.clipboard.writeText(url); notify("Agreement link copied. Share it directly with this customer."); }
    catch { notify("Select and copy the agreement link below."); }
  }
  async function recordPaper(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !latest || file.size > 4 * 1024 * 1024) { notify("Attach a signed PDF, JPG or PNG smaller than 4 MB.", true); return; }
    setWorking(true); notify(""); paperRequestId.current ??= crypto.randomUUID();
    const form = new FormData();
    form.set("file", file); form.set("agreementId", latest.id); form.set("requestId", paperRequestId.current); form.set("name", paperName); form.set("signedOn", signedOn);
    try {
      const res = await fetch(`${endpoint}/paper`, { method: "POST", body: form }), data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The signed copy could not be recorded.");
      notify(data.message); paperRequestId.current = null; setPaper(false); router.refresh();
    } catch (e) { notify(e instanceof Error ? e.message : "The signed copy could not be recorded.", true); }
    finally { setWorking(false); }
  }
  return <section className="my-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 sm:p-5 print:hidden" aria-label="Rental agreement controls">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-base font-black text-slate-950"><FileSignature className="h-5 w-5 text-cyan-800" />Rental agreement</h3><p className="mt-1 text-sm text-slate-600">{latest ? `Version ${latest.version} · ${latest.snapshot.title}` : "Prepare a copy from your saved template for this rental."}</p></div><span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${state === "signed" ? "bg-emerald-100 text-emerald-900" : state === "failed" ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-950"}`}>{agreementStateLabel[state]}</span></div>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Send to</p><p className="mt-1 break-all font-semibold text-slate-900">{customerEmail || "No email on this booking"}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{latest?.status === "superseded" ? "Previous signer" : "Signed by"}</p><p className="mt-1 font-semibold text-slate-900">{latest?.signer_legal_name ?? "Not signed yet"}</p></div></div>
    {editable && !validAgreementEmail(customerEmail) ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Add a valid email with <strong>Edit rental</strong> to send an agreement. You can still print it or copy its signing link.</p> : null}
    {!editable ? <p className="mt-3 text-sm text-slate-600">This booking is closed. Previous agreements remain available for your records.</p> : null}
    {latest?.signed_at ? <p className="mt-3 text-xs text-slate-600">{latest.signature_method === "paper" ? `Paper signed ${latest.paper_signed_on} · Recorded by ${latest.paper_recorded_by}` : `Signed ${eastern(latest.signed_at)} (Eastern)`}</p> : null}
    {latest?.last_emailed_at ? <p className={`mt-2 text-xs ${latest.email_status === "failed" ? "font-bold text-rose-800" : "text-slate-600"}`}>Last email {latest.email_status === "failed" ? "failed" : "sent"} · {eastern(latest.last_emailed_at)} (Eastern){latest.email_status === "sent" ? " · Sent does not confirm the customer has opened it." : " · Retry below."}</p> : null}
    {mismatch ? <p className="mt-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-950">The signer’s name differs from {customerName}. Check with the customer, record a name review, or request a corrected signature.</p> : null}
    {latest?.reviewed_at ? <p className="mt-2 text-xs text-slate-600">Name reviewed by {latest.reviewed_by} · {eastern(latest.reviewed_at)} (Eastern)</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      {editable && latest?.status !== "signed" ? <button type="button" disabled={working || !validAgreementEmail(customerEmail)} onClick={() => { setSendReview("signing"); requestId.current = null; }} className={primary}><Mail className="h-4 w-4" />{needsPreparation ? "Prepare & send agreement" : latest?.email_status === "sent" ? "Resend signing link" : latest?.email_status === "failed" ? "Retry email" : "Send signing link"}</button> : null}
      {editable && needsPreparation && !preparedPath ? <button type="button" disabled={working} onClick={() => act("prepare")} className={button}><Printer className="h-4 w-4" />Prepare for printing</button> : null}
      {sharePath ? <a href={sharePath} target="_blank" rel="noreferrer" className={button}><Printer className="h-4 w-4" />{latest?.status === "signed" ? "View / print signed copy" : "View / print for signature"}</a> : null}
      {sharePath || editable ? <button type="button" disabled={working} onClick={copyLink} className={button}><Copy className="h-4 w-4" />Copy {latest?.status === "signed" ? "agreement" : "signing"} link</button> : null}
      {latest?.signed_at ? <button type="button" disabled={working || !validAgreementEmail(customerEmail)} onClick={() => { setSendReview("signed"); requestId.current = null; }} className={button}><Mail className="h-4 w-4" />Email signed copy</button> : null}
      {editable && currentUnsigned ? <button type="button" disabled={working} onClick={() => setPaper(!paper)} className={button}><Upload className="h-4 w-4" />Record paper signature</button> : null}
      {mismatch && !latest?.reviewed_at ? <button type="button" disabled={working} onClick={() => act("review_name", latest.id)} className={button}><CheckCircle2 className="h-4 w-4" />Mark name reviewed</button> : null}
    </div>
    {latest?.signature_method === "paper" ? <a href={`${latest.path.replace("/rental-agreement/", "/api/rental-agreement/")}/paper-copy`} className="mt-3 inline-flex text-sm font-bold text-cyan-900 underline">Download original signed paper copy</a> : null}
    {sendReview ? <div className="mt-4 rounded-xl border border-cyan-200 bg-white p-4"><h4 className="font-bold text-slate-950">Review email recipient</h4><p className="mt-2 break-all text-sm">{customerName} · {customerEmail}</p><p className="mt-2 text-sm text-slate-600">{sendReview === "signed" ? "Send a copy of the saved signed agreement." : needsPreparation ? "Prepare an agreement with the current rental details and saved template, then send its signing link." : "Send the signing link for the current agreement version."}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={working} className={primary} onClick={() => act(sendReview === "signed" ? "email_signed" : "prepare_send", latest?.id)}>{working ? "Sending…" : sendReview === "signed" ? "Send signed copy" : "Send agreement"}</button><button type="button" disabled={working} className={button} onClick={() => setSendReview(null)}>Close</button></div></div> : null}
    {copiedLink ? <label className="mt-3 block text-xs font-bold text-slate-600">Private agreement link<input readOnly value={copiedLink} onFocus={e => e.target.select()} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-normal text-slate-950" /></label> : null}
    {paper && currentUnsigned ? <form onSubmit={recordPaper} className="mt-4 space-y-3 rounded-xl border border-cyan-200 bg-white p-4"><h4 className="font-bold">Record the customer’s signed paper copy</h4><p className="text-sm text-slate-600">Upload the signed copy of version {latest.version}. Printing alone does not mark this booking signed.</p><label className="block text-sm font-bold">Signer’s full name<input required minLength={2} maxLength={120} value={paperName} onChange={e => { setPaperName(e.target.value); paperRequestId.current = null; }} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base font-normal" /></label><label className="block text-sm font-bold">Date signed<input required type="date" min={ymd(new Date(latest.created_at))} max={ymd()} value={signedOn} onChange={e => { setSignedOn(e.target.value); paperRequestId.current = null; }} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base font-normal" /></label><label className="block text-sm font-bold">Signed PDF, JPG or PNG · maximum 4 MB<input required type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => { setFile(e.target.files?.[0] ?? null); paperRequestId.current = null; }} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-base font-normal" /></label><label className="flex items-start gap-2 text-sm"><input required type="checkbox" className="mt-1 h-4 w-4" />I verified that this upload shows the customer’s signature on this agreement version.</label><div className="flex flex-wrap gap-2"><button disabled={working} className={primary}>{working ? "Recording…" : "Save signed paper copy"}</button><button type="button" disabled={working} onClick={() => setPaper(false)} className={button}>Close</button></div></form> : null}
    {editable ? <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-slate-600">Terms & agreement versions</summary><button type="button" disabled={working} onClick={edit} className={`${button} mt-3`}>{latest ? "Edit terms / request a new signature" : "Customize this rental’s terms"}</button></details> : null}
    {editing ? <div className="mt-4 space-y-4 rounded-xl border border-cyan-200 bg-white p-4"><p className="text-sm text-slate-600">Saving creates a new version with the current rental details and requires a new signature. Previous signed copies remain in history.</p><label className="block text-sm font-bold">Agreement terms<textarea rows={10} maxLength={20000} value={terms} onChange={e => { setTerms(e.target.value); requestId.current = null; }} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal leading-relaxed" /></label><label className="block text-sm font-bold">Additional terms for this rental<textarea rows={3} maxLength={10000} value={extra} onChange={e => { setExtra(e.target.value); requestId.current = null; }} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label><div className="flex flex-wrap gap-2"><button type="button" disabled={working || terms.trim().length < 20} onClick={() => act("create")} className={primary}>{working ? "Saving…" : "Save new agreement version"}</button><button type="button" disabled={working} onClick={() => setEditing(false)} className={button}>Close</button></div></div> : null}
    {message ? <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${error ? "bg-rose-50 text-rose-900" : "bg-white text-cyan-950"}`} role={error ? "alert" : "status"}>{message}</p> : null}
    {history.length > 1 ? <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Agreement history · {history.length} versions</summary><ul className="mt-2 space-y-2">{history.map(a => <li key={a.id}><a href={a.path} target="_blank" rel="noreferrer" className="text-sm text-cyan-900 underline">v{a.version} · {a.status.replaceAll("_", " ")}{a.signer_legal_name ? ` · ${a.signer_legal_name}` : ""}</a></li>)}</ul></details> : null}
  </section>;
}
