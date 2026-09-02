import { AdminAuthError } from "@/app/admin/_components";
import { InvoicePrintDocument } from "@/app/admin/invoices/InvoicePrintDocument";
import { PrintInvoiceButton } from "@/app/admin/invoices/PrintInvoiceButton";
import { verifyAdminAccess } from "@/lib/admin/session";
import { createTestInvoice } from "@/lib/invoices/shared";

export default async function TestInvoicePrintPage() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  return <main className="min-h-screen bg-slate-200 p-4 text-slate-950 print:bg-white print:p-0"><div className="mx-auto mb-4 flex max-w-4xl justify-end print:hidden"><PrintInvoiceButton /></div><InvoicePrintDocument invoice={createTestInvoice()} /></main>;
}
