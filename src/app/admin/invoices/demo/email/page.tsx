import { AdminAuthError } from "@/app/admin/_components";
import { InvoiceEmailPreview } from "@/app/admin/invoices/InvoiceEmailPreview";
import { verifyAdminAccess } from "@/lib/admin/session";
import { createTestInvoice } from "@/lib/invoices/shared";

export default async function TestInvoiceEmailPage() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  return <InvoiceEmailPreview invoice={createTestInvoice()} />;
}
