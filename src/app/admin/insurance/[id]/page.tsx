import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { DOCUMENTS, isDocumentId } from "@/lib/insurance/documents";
import { loadDocument } from "@/lib/insurance/store";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../../_components";
import { InsuranceEditor } from "../InsuranceEditor";
export const dynamic = "force-dynamic";
export default async function InsuranceDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const { id } = await params;
  if (!isDocumentId(id)) notFound();
  const definition = DOCUMENTS.find(d => d.id === id)!;
  const record = await loadDocument(id).catch(() => null);
  return <AdminShell>
    <AdminHeader eyebrow="Insurance & Safety Documents" title={definition.title} />
    <AdminNav token="" role={auth.role} active="insurance" />
    <Link href="/admin/insurance" className="mt-5 inline-block font-bold text-sky-800 underline">← All insurance documents</Link>
    {record ? <InsuranceEditor initial={record} /> : <section className="mt-5 rounded-xl border border-rose-200 bg-white p-6"><h2 className="text-xl font-black">Document unavailable</h2><p className="mt-2 text-slate-600">Saved information could not be loaded. Reload this page before editing; your saved document has not been replaced.</p></section>}
  </AdminShell>;
}
