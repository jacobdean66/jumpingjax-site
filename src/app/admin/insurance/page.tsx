import Link from "next/link";
import { FileText, ShieldCheck, ArrowUpRight } from "lucide-react";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { DOCUMENTS } from "@/lib/insurance/documents";
import { loadDocumentSummary } from "@/lib/insurance/store";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { PacketDownload } from "./InsuranceEditor";
export const dynamic = "force-dynamic";
export default async function InsurancePage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const summaries = await loadDocumentSummary();
  const reviewed = summaries.filter(s => s.reviewed && !s.error).length;
  return <AdminShell>
    <AdminHeader eyebrow="Management · Owner access" title="Insurance & Safety Documents"><PacketDownload /></AdminHeader>
    <AdminNav token="" role={auth.role} active="insurance" />
    <section className="mt-6 rounded-2xl bg-sky-950 p-6 text-white sm:p-8">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-200"><ShieldCheck size={18} /> Indoor center + rentals</div>
      <h2 className="mt-3 text-2xl font-black sm:text-3xl">Everything for your insurance review, together.</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-100">The seven items requested for your formal quote. Open a document to review its draft, fill in verified details, attach originals and print or download a copy.</p>
      <p className="mt-4 text-sm font-bold">{reviewed} of 7 marked reviewed by owner · Review packet may contain incomplete drafts</p>
    </section>
    {summaries.some(s => s.error) && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">Some saved documents could not be loaded. Retry before editing or assuming there are no attachments.</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {DOCUMENTS.map((doc, i) => {
        const saved = summaries.find(s => s.id === doc.id)!;
        const status = saved.error ? "Unable to load" : saved.reviewed ? "Owner marked reviewed" : doc.kind === "external" ? "Carrier records needed" : doc.kind === "live" ? "Current form copies" : doc.kind === "inventory" ? "Inventory · values to verify" : "Draft · details to verify";
        return <Link key={doc.id} href={`/admin/insurance/${doc.id}`} prefetch={false} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600">
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-black text-sky-800"><FileText size={19} /> {String(i + 1).padStart(2, "0")}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${saved.reviewed && !saved.error ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>{status}</span></div>
          <h2 className="mt-4 text-xl font-black">{doc.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{doc.description}</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">{doc.needs}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-sm font-bold"><span className="text-slate-500">{saved.error ? "Retry required" : `${saved.attachments} attached originals`}</span><span className="flex items-center gap-1 text-sky-800">Open document <ArrowUpRight size={17} /></span></div>
        </Link>;
      })}
    </div>
    <p className="mt-6 max-w-4xl text-sm leading-6 text-slate-600">Loss runs must come from the insurers covering the current policy and three prior years. Facility routes, equipment counts and insured values must reflect the actual business. The packet keeps drafts visibly labeled until you review them.</p>
  </AdminShell>;
}
