"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Save, Paperclip, Plus, Trash2 } from "lucide-react";
import { DOCUMENTS, EQUIPMENT_COLUMNS, emptyEquipmentRow, type DocumentRecord } from "@/lib/insurance/documents";

const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-800 px-4 py-3 text-sm font-bold text-white hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
async function downloadFile(url: string, fallbackName: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? "Download failed. Please retry."); }
  const blob = await response.blob();
  const name = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = href; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(href), 10000);
}
export function PacketDownload() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <div><button className={primary} disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await downloadFile("/api/admin/insurance/packet", "jumping-jax-insurance-review-packet.zip"); } catch (e) { setError(e instanceof Error ? e.message : "Download failed."); } finally { setBusy(false); } }}><Download size={17} /> {busy ? "Preparing packet…" : "Download review packet"}</button>{error && <p role="alert" className="mt-2 max-w-sm text-sm text-rose-800">{error}</p>}</div>;
}
export function InsuranceEditor({ initial }: { initial: DocumentRecord }) {
  const [record, setRecord] = useState(initial); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const definition = DOCUMENTS.find(d => d.id === record.id)!;
  const api = `/api/admin/insurance/${record.id}`;
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function edit(changes: Partial<DocumentRecord>) { setRecord(r => ({ ...r, ...changes, reviewed: changes.reviewed ?? false })); setDirty(true); setMessage(""); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: record.text, equipment: record.equipment, reviewed: record.reviewed }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Save failed.");
      setRecord(r => ({ ...r, ...body.saved })); setDirty(false); setMessage("Saved to private storage. Available on your other devices.");
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } finally { setBusy(false); }
  }
  async function download(format: "html" | "csv") {
    setBusy(true); setError(""); try { await downloadFile(`${api}?format=${format}&download=1`, `${record.id}.${format}`); } catch (e) { setError(e instanceof Error ? e.message : "Download failed."); } finally { setBusy(false); }
  }
  async function upload() {
    const file = fileRef.current?.files?.[0]; if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("Choose a file no larger than 3 MB."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`${api}/attachments`, { method: "POST", body: form });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Upload failed.");
      setRecord(r => ({ ...r, attachments: body.attachments })); if (fileRef.current) fileRef.current.value = ""; setMessage("Original file attached in private storage.");
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); } finally { setBusy(false); }
  }
  return <div className="mt-5 space-y-5">
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-sm font-black text-amber-950">{record.reviewed ? "Owner marked reviewed" : definition.kind === "live" ? "Current template copies · insurer review required" : "Draft / incomplete · verification required"}</p>
      <p className="mt-2 text-sm leading-6 text-amber-950">{definition.needs}</p>
      {record.sourceError && <p role="alert" className="mt-3 font-bold text-rose-800">{record.sourceError} Reload this page to retry.</p>}
    </section>
    <div className="flex flex-wrap gap-2">
      <button className={primary} disabled={busy || !!record.sourceError} onClick={() => void save()}><Save size={17} />{busy ? "Working…" : "Save document"}</button>
      <a href={`${api}?format=html`} target="_blank" rel="noreferrer" aria-disabled={dirty || busy || !!record.sourceError} onClick={e => { if (dirty || busy || record.sourceError) e.preventDefault(); }} className={`${secondary} ${dirty || busy || record.sourceError ? "opacity-50" : ""}`}>View / print / save PDF</a>
      <button className={secondary} disabled={busy || dirty || !!record.sourceError} onClick={() => void download("html")}><Download size={17} />Download document</button>
      {record.id === "equipment-schedule" && <button className={secondary} disabled={busy || dirty || !!record.sourceError} onClick={() => void download("csv")}>Download spreadsheet (CSV)</button>}
    </div>
    <div aria-live="polite">{dirty && <p className="text-sm font-bold text-amber-900">Unsaved changes — save before printing or downloading.</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}</div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">{definition.kind === "live" ? "About the current forms" : "Document content"}</h2><p className="mt-1 text-sm text-slate-600">{definition.kind === "live" ? "Open the printable copy to see both current templates. Active signing terms remain managed by the existing waiver and rental workflows." : "Edit the draft to match your actual operation. Bracketed fields need verified information."}</p></div></div>
      <label htmlFor="insurance-content" className="mt-4 block text-sm font-bold">{definition.kind === "live" ? "Review notes" : "Draft text"}</label>
      <textarea id="insurance-content" value={record.text} disabled={busy} onChange={e => edit({ text: e.target.value })} rows={definition.kind === "live" ? 12 : 24} className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-sky-600 disabled:opacity-70" />
    </section>
    {record.id === "equipment-schedule" && <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-black">Rental equipment details</h2><p className="mt-2 text-sm text-slate-600">Inventory listings seed the names. Complete physical unit counts and insurance values; add separate rows for individual units and supporting equipment.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1400px] border-collapse text-sm"><thead><tr>{EQUIPMENT_COLUMNS.map(c => <th key={c.key} className="border border-slate-200 bg-slate-100 p-2 text-left">{c.label}</th>)}<th className="p-2">Remove</th></tr></thead><tbody>{record.equipment.map((row, i) => <tr key={i}>{EQUIPMENT_COLUMNS.map(c => <td key={c.key} className="border border-slate-200 p-1"><input aria-label={`${c.label}, row ${i + 1}`} value={row[c.key]} disabled={busy} maxLength={500} inputMode={c.key === "quantity" || c.key === "replacementValue" || c.key === "year" ? "decimal" : undefined} onChange={e => edit({ equipment: record.equipment.map((r, n) => n === i ? { ...r, [c.key]: e.target.value } : r) })} className="min-h-11 w-full min-w-28 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-sky-600" /></td>)}<td className="p-2"><button type="button" disabled={busy} aria-label={`Remove equipment row ${i + 1}`} onClick={() => edit({ equipment: record.equipment.filter((_, n) => n !== i) })} className="min-h-11 rounded-lg p-3 text-rose-700 hover:bg-rose-50"><Trash2 size={18} /></button></td></tr>)}</tbody></table></div>
      <button className={`${secondary} mt-4`} disabled={busy || record.equipment.length >= 300} onClick={() => edit({ equipment: [...record.equipment, emptyEquipmentRow()] })}><Plus size={17} /> Add equipment row</button>
    </section>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-xl font-black"><Paperclip size={21} /> Attached originals</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Attach carrier reports, a verified floor plan or existing approved documents. PDF, PNG or JPEG; up to 3 MB per file. Files remain private and are included in the review packet.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm font-bold" htmlFor="insurance-file">Choose original</label><input id="insurance-file" type="file" accept="application/pdf,image/png,image/jpeg" ref={fileRef} disabled={busy} className="max-w-full text-sm" /><button className={secondary} disabled={busy} onClick={() => void upload()}>Attach file</button></div>
      <ul className="mt-4 space-y-2">{record.attachments.map(file => <li key={file.path}><button className="break-all text-left text-sm font-bold text-sky-800 underline" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await downloadFile(`${api}/attachments?file=${encodeURIComponent(file.path)}`, file.name); } catch (e) { setError(e instanceof Error ? e.message : "Download failed."); } finally { setBusy(false); } }}>{file.name}</button> <span className="text-xs text-slate-500">({Math.ceil(file.size / 1024)} KB)</span></li>)}</ul>
      {!record.attachments.length && <p className="mt-4 text-sm text-slate-500">No original files attached yet.</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-black">Owner review</h2><label className="mt-3 flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={record.reviewed} disabled={busy || !!record.sourceError} onChange={e => edit({ reviewed: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-sky-800" /><span>I have checked this document, completed the applicable site details and verified the attached records. Mark it reviewed by the owner.</span></label>
      <p className="mt-3 text-xs text-slate-500">{record.updatedAt ? `Last saved ${new Date(record.updatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} Eastern · ${record.updatedBy}` : "Not saved or reviewed yet."}</p>
      <button className={`${primary} mt-4`} disabled={busy || !!record.sourceError} onClick={() => void save()}><Save size={17} /> Save document & review status</button>
    </section>
  </div>;
}
