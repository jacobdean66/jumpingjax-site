import Image from "next/image";

import { AdminAuthError } from "@/app/admin/_components";
import { PrintInvoiceButton } from "@/app/admin/invoices/PrintInvoiceButton";
import { verifyAdminAccess } from "@/lib/admin/session";
import { calculateInvoiceTotals, type InvoiceKind } from "@/lib/invoices/shared";
import { loadBookingInvoice } from "@/lib/invoices/store";

export const dynamic = "force-dynamic";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ copy?: string }>;
}) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const resolved = await params;
  const kind: InvoiceKind | null = resolved.kind === "rental" || resolved.kind === "facility" || resolved.kind === "standalone" ? resolved.kind : null;
  const invoice = kind ? await loadBookingInvoice(kind, resolved.id) : null;
  if (!invoice) return <main className="p-8"><h1 className="text-2xl font-black">Invoice not found</h1></main>;
  const totals = calculateInvoiceTotals(invoice);
  const copyLabel = (await searchParams).copy === "office" ? "OFFICE COPY" : "CUSTOMER COPY";

  return (
    <main className="min-h-screen bg-slate-200 p-4 text-slate-950 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end print:hidden"><PrintInvoiceButton /></div>
      <article className="mx-auto max-w-4xl bg-white p-8 shadow-xl print:max-w-none print:p-5 print:shadow-none">
        <header className="grid grid-cols-[1fr_180px] gap-5 border-t-8 border-sky-950 border-b-4 border-b-rose-500 py-5">
          <div><Image src="/logo.png" alt="Jumping Jax" width={260} height={100} className="max-h-24 w-auto object-contain object-left" priority /><p className="mt-2 text-sm font-semibold text-slate-600">559 Beaudrot Road, Greenwood, SC<br />864-933-1420 · info@jumpingjaxllc.com<br />jumpingjaxllc.com</p></div>
          <div className="relative overflow-hidden rounded-xl"><Image src="/hero.jpg" alt="Jumping Jax waterslide" fill className="object-cover" /><div className="absolute right-0 top-0 text-right"><span className="inline-block bg-rose-500 px-3 py-2 text-lg font-black text-white">INVOICE</span><span className="block bg-white/95 px-2 py-1 text-[10px] font-black tracking-wider text-sky-950">{copyLabel}</span></div></div>
        </header>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm"><p><strong>Invoice #</strong><br />{invoice.invoiceNumber}</p><p><strong>Invoice date</strong><br />{invoice.invoiceDate}</p><p><strong>Due date</strong><br />{invoice.dueDate}</p></div>
        <div className="mt-5 grid grid-cols-2 gap-5"><section><h2 className="bg-sky-950 px-3 py-2 text-xs font-black text-white">BILL TO</h2><div className="min-h-32 border p-3 text-sm whitespace-pre-line"><strong>{invoice.customerName}</strong><br />{invoice.customerEmail}<br />{invoice.customerPhone}<br />{invoice.billingAddress}</div></section><section><h2 className="bg-sky-950 px-3 py-2 text-xs font-black text-white">EVENT / DELIVERY DETAILS</h2><div className="min-h-32 border p-3 text-sm whitespace-pre-line">{invoice.eventDate}<br />{invoice.eventAddress}<br />{invoice.eventDetails}</div></section></div>
        <table className="mt-5 w-full border-collapse text-sm"><thead><tr className="bg-sky-950 text-white"><th className="p-3 text-left">Description</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Unit price</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{invoice.lineItems.map((line) => <tr key={line.id} className="border-b"><td className="p-3">{line.description}</td><td className="p-3 text-center">{line.quantity}</td><td className="p-3 text-right">{formatMoney(line.unitPrice)}</td><td className="p-3 text-right font-bold">{formatMoney(line.quantity * line.unitPrice)}</td></tr>)}</tbody></table>
        <div className="mt-5 grid grid-cols-[1fr_300px] gap-6"><div><p className="whitespace-pre-line text-sm">{invoice.notes}</p><div className="mt-5 border-l-4 border-rose-500 px-4 py-2 text-sm"><strong>REMIT PAYMENT TO</strong><br />Jumping Jax LLC<br />86 Brock Road<br />Honea Path, SC 29654<br /><span className="mt-2 inline-block font-bold">Payment due by the due date shown above. Make checks payable to Jumping Jax LLC and include the invoice number.</span></div></div><div className="space-y-2 text-sm"><p className="flex justify-between"><span>Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></p><p className="flex justify-between"><span>Delivery fee</span><strong>{formatMoney(invoice.deliveryFee)}</strong></p><p className="flex justify-between"><span>Discount</span><strong>-{formatMoney(invoice.discount)}</strong></p><p className="flex justify-between"><span>Sales tax</span><strong>{formatMoney(invoice.tax)}</strong></p><p className="flex justify-between"><span>Payments received</span><strong>-{formatMoney(invoice.paymentsReceived)}</strong></p><p className="flex justify-between bg-sky-950 p-3 text-lg font-black text-white"><span>Balance due</span><span>{formatMoney(totals.balanceDue)}</span></p></div></div>
        <p className="mt-6 bg-sky-50 p-4 text-center text-xl font-black text-rose-500">Thank you for your business!</p>
      </article>
    </main>
  );
}
