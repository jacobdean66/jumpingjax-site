"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Printer, ClipboardCheck } from "lucide-react";
import { agreementState, agreementStateLabel, canRequestAgreement, defaultAgreementSelection, validAgreementEmail, type AgreementBatchBooking } from "@/lib/rental-agreements/workflow";

const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50";
export function RentalAgreementBatch({ bookings }: { bookings: AgreementBatchBooking[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [includeSigned, setIncludeSigned] = useState(false);
  const [selected, setSelected] = useState(() => new Set(defaultAgreementSelection(bookings)));
  const [working, setWorking] = useState(false), [review, setReview] = useState(false), [results, setResults] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(""), [printIds, setPrintIds] = useState<string[]>([]);
  const requestIds = useRef(new Map<string, string>());
  const unsigned = bookings.filter(b => canRequestAgreement(b.status, b.agreement));
  const visible = includeSigned ? bookings : unsigned;
  const chosen = bookings.filter(b => selected.has(b.id));
  const recipients = chosen.filter(b => canRequestAgreement(b.status, b.agreement) && validAgreementEmail(b.customerEmail));
  const missingEmail = unsigned.filter(b => !validAgreementEmail(b.customerEmail)).length;
  async function run(kind: "send" | "print") {
    const targets = kind === "send" ? recipients : chosen;
    if (!targets.length || targets.length > 40) { setMessage("Choose between 1 and 40 rentals for this batch."); return; }
    setWorking(true); setMessage(""); setPrintIds([]);
    const output: Record<string, string> = {}, printable: string[] = [];
    for (let index = 0; index < targets.length; index++) {
      const booking = targets[index], key = `${kind}:${booking.id}`;
      setMessage(`${kind === "send" ? "Sending" : "Preparing"} ${index + 1} of ${targets.length}…`);
      try {
        if (kind === "print" && booking.agreement?.status === "signed") {
          printable.push(booking.agreement.id); output[booking.id] = "Signed copy ready to print.";
        } else {
          const requestId = requestIds.current.get(key) ?? crypto.randomUUID(); requestIds.current.set(key, requestId);
          const res = await fetch(`/api/admin/rentals/${encodeURIComponent(booking.id)}/agreement`, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: kind === "send" ? "prepare_send" : "prepare", requestId, expectedEmail: booking.customerEmail }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? data.message ?? "Agreement action failed. Retry this rental.");
          output[booking.id] = data.message; requestIds.current.delete(key);
          if (kind === "print" && data.agreementId) printable.push(data.agreementId);
        }
      } catch (error) { output[booking.id] = `Needs attention: ${error instanceof Error ? error.message : "Request failed. Retry this rental."}`; }
      setResults({ ...output });
    }
    setPrintIds(printable); setWorking(false); setReview(false);
    const failures = Object.values(output).filter(v => v.startsWith("Needs attention:")).length;
    setMessage(`${targets.length - failures} of ${targets.length} rentals ${kind === "send" ? "processed" : "ready to print"}.${failures ? ` ${failures} need attention below.` : ""}`);
    router.refresh();
  }
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-black text-slate-950"><ClipboardCheck className="h-5 w-5 text-cyan-800" />Agreement catch-up</h2><p className="mt-1 text-sm text-slate-600">{unsigned.length} unsigned in this date range{missingEmail ? ` · ${missingEmail} need an email address` : ""}. Signed rentals are skipped when sending.</p></div><button type="button" disabled={working} onClick={() => setOpen(!open)} className={secondary}>{open ? "Close review" : `Review unsigned (${unsigned.length})`}</button></div>
    {open ? <div className="mt-4 border-t border-slate-200 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Already emailed rentals start unchecked. Select them only if you want to send a reminder.</p><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={working} checked={includeSigned} onChange={e => { setIncludeSigned(e.target.checked); setReview(false); }} className="h-4 w-4" />Include signed copies for printing</label></div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{visible.map(b => <label key={b.id} className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 ${selected.has(b.id) ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-slate-50"}`}><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={selected.has(b.id)} disabled={working || (!canRequestAgreement(b.status, b.agreement) && b.agreement?.status !== "signed")}
        onChange={e => { setSelected(previous => { const next = new Set(previous); if (e.target.checked) next.add(b.id); else next.delete(b.id); return next; }); setReview(false); setPrintIds([]); }} />
        <span className="min-w-0 text-sm"><span className="block font-bold text-slate-950">{b.rentalNames} · {b.city}</span><span className="mt-1 block text-slate-600">{b.customerName} · {b.eventDate} · #{b.id}</span><span className="mt-1 block font-semibold text-cyan-900">{agreementStateLabel[agreementState(b.customerName, b.agreement)]}</span><span className={`mt-1 block break-all ${validAgreementEmail(b.customerEmail) ? "text-slate-600" : "font-bold text-amber-900"}`}>{validAgreementEmail(b.customerEmail) ? b.customerEmail : "Missing / invalid email · Print or edit this booking"}</span>{results[b.id] ? <span className={`mt-2 block font-semibold ${results[b.id].startsWith("Needs attention:") ? "text-rose-800" : "text-emerald-800"}`}>{results[b.id]}</span> : null}</span></label>)}</div>
      {!visible.length ? <p className="py-4 text-sm text-slate-600">No unsigned active rentals in this date range.</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-800 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-900 disabled:opacity-50" disabled={working || !recipients.length || recipients.length > 40} onClick={() => setReview(true)}><Mail className="h-4 w-4" />Review & send ({recipients.length})</button><button type="button" className={secondary} disabled={working || !chosen.length || chosen.length > 40} onClick={() => run("print")}><Printer className="h-4 w-4" />Prepare selected for printing ({chosen.length})</button><span className="text-xs text-slate-500">Up to 40 rentals per batch</span></div>
      {review ? <div className="mt-4 rounded-xl border border-cyan-300 bg-cyan-50 p-4"><h3 className="font-bold text-slate-950">Send {recipients.length} signing request{recipients.length === 1 ? "" : "s"}?</h3><p className="mt-2 text-sm text-slate-700">Review the selected recipients above. Missing agreements will use your saved template. Current unsigned versions are reused.</p>{chosen.length !== recipients.length ? <p className="mt-2 text-sm font-bold text-amber-900">{chosen.length - recipients.length} selected rental(s) excluded from sending because they are signed, closed, or missing an email.</p> : null}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={working} onClick={() => run("send")} className="min-h-11 rounded-xl bg-cyan-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{working ? "Sending…" : "Send selected agreements"}</button><button type="button" disabled={working} onClick={() => setReview(false)} className={secondary}>Back to review</button></div></div> : null}
      {printIds.length ? <a className={`${secondary} mt-3`} href={`/admin/rentals/agreements/print?ids=${encodeURIComponent(printIds.join(","))}`} target="_blank" rel="noreferrer"><Printer className="h-4 w-4" />Open {printIds.length} printable agreement{printIds.length === 1 ? "" : "s"}</a> : null}
    </div> : null}
    {message ? <p role="status" className="mt-3 text-sm font-semibold text-slate-700">{message}</p> : null}
  </section>;
}
