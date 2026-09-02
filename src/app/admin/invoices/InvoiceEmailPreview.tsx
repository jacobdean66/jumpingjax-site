import type { BookingInvoice } from "@/lib/invoices/shared";
import { invoiceEmailHtml } from "@/lib/invoices/store";

export function InvoiceEmailPreview({ invoice }: { invoice: BookingInvoice }) {
  return (
    <main className="min-h-screen bg-slate-200 px-4 py-8 text-slate-950">
      <div className="mx-auto mb-3 max-w-3xl rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm">
        <p><strong>To:</strong> {invoice.customerEmail || "Customer email"}</p>
        <p><strong>Subject:</strong> Jumping Jax invoice {invoice.invoiceNumber}</p>
      </div>
      <div className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl" dangerouslySetInnerHTML={{ __html: invoiceEmailHtml(invoice) }} />
    </main>
  );
}
