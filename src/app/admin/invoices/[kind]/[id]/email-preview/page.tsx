import { AdminAuthError } from "@/app/admin/_components";
import { InvoiceEmailPreview } from "@/app/admin/invoices/InvoiceEmailPreview";
import { verifyAdminAccess } from "@/lib/admin/session";
import type { InvoiceKind } from "@/lib/invoices/shared";
import { loadBookingInvoice } from "@/lib/invoices/store";

export const dynamic = "force-dynamic";

export default async function EmailPreviewPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const resolved = await params;
  const kind: InvoiceKind | null = resolved.kind === "rental" || resolved.kind === "facility" || resolved.kind === "standalone" ? resolved.kind : null;
  const invoice = kind ? await loadBookingInvoice(kind, resolved.id) : null;
  if (!invoice) return <main className="p-8"><h1 className="text-2xl font-black">Invoice not found</h1></main>;
  return <InvoiceEmailPreview invoice={invoice} />;
}
