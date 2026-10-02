"use client";
import { useState } from "react";
import type { RentalAgreementTemplate } from "@/lib/rental-agreements/types";
export function RentalAgreementTemplateEditor() {
  const [template, setTemplate] = useState<RentalAgreementTemplate | null>(null);
  const [working, setWorking] = useState(false); const [message, setMessage] = useState("");
  async function load() {
    setWorking(true); setMessage("");
    try { const res = await fetch("/api/admin/rental-agreement-template", { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setTemplate(data); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Unable to load the agreement template."); } finally { setWorking(false); }
  }
  async function save() {
    setWorking(true); setMessage("");
    try { const res = await fetch("/api/admin/rental-agreement-template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(template) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setTemplate(t => t ? { ...t, version: data.version } : null); setMessage("Template saved for future rental requests. Existing signed copies are preserved."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save the agreement template."); } finally { setWorking(false); }
  }
  return <section className="mt-5 print:hidden"><button type="button" disabled={working} onClick={load} className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Edit rental agreement template</button>
    {template ? <div className="mt-4 rounded-2xl border border-cyan-200 bg-white p-5"><h2 className="text-lg font-black">Rental agreement template · v{template.version}</h2><p className="mt-2 text-sm text-slate-600">These terms appear on future rental requests. Use the agreement controls on a rental card to revise an existing booking.</p>
      <label className="mt-4 block text-sm font-bold">Title<input maxLength={160} value={template.title} onChange={e => setTemplate({ ...template, title: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label>
      <label className="mt-4 block text-sm font-bold">Terms and safety rules<textarea rows={15} maxLength={20000} value={template.terms} onChange={e => setTemplate({ ...template, terms: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal leading-relaxed" /></label>
      <div className="mt-4 flex gap-2"><button type="button" disabled={working} onClick={save} className="rounded-full bg-cyan-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{working ? "Saving…" : "Save template"}</button><button type="button" disabled={working} onClick={() => setTemplate(null)} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold">Close</button></div>
    </div> : null}{message ? <p className="mt-3 text-sm font-semibold" role="status">{message}</p> : null}
  </section>;
}
