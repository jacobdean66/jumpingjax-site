"use client";

import { useMemo, useState } from "react";
import { Eye, Mail, Plus, Printer, ReceiptText, Save, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  calculateInvoiceTotals,
  type BookingInvoice,
  type InvoiceKind,
} from "@/lib/invoices/shared";

type Props = {
  kind: InvoiceKind;
  bookingId: string;
  initialInvoice?: BookingInvoice;
  label?: string;
};

const inputClass =
  "mt-1 w-full rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function BookingInvoiceButton({ kind, bookingId, initialInvoice, label = "Invoice" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invoice, setInvoice] = useState<BookingInvoice | null>(initialInvoice ?? null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const totals = useMemo(
    () => invoice ? calculateInvoiceTotals(invoice) : null,
    [invoice],
  );
  const endpoint = `/api/admin/invoices/${kind}/${encodeURIComponent(bookingId)}`;

  async function openInvoice() {
    setOpen(true);
    setMessage("");
    if (invoice) return;
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; invoice?: BookingInvoice; message?: string };
      if (!response.ok || !body.invoice) throw new Error(body.message || "Could not load invoice.");
      setInvoice(body.invoice);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load invoice.");
    } finally {
      setLoading(false);
    }
  }

  function patch(fields: Partial<BookingInvoice>) {
    setInvoice((current) => current ? { ...current, ...fields } : current);
  }

  function updateLine(index: number, fields: Partial<BookingInvoice["lineItems"][number]>) {
    if (!invoice) return;
    patch({
      lineItems: invoice.lineItems.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...fields } : line,
      ),
    });
  }

  function addLine() {
    if (!invoice) return;
    patch({
      lineItems: [
        ...invoice.lineItems,
        {
          id: `staff-${Date.now()}`,
          description: "Additional rental or service",
          quantity: 1,
          unitPrice: 0,
        },
      ],
    });
  }

  function removeLine(index: number) {
    if (!invoice || invoice.lineItems.length === 1) return;
    patch({ lineItems: invoice.lineItems.filter((_, lineIndex) => lineIndex !== index) });
  }

  async function save(): Promise<boolean> {
    if (!invoice) return false;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invoice),
      });
      const body = await response.json() as { ok?: boolean; invoice?: BookingInvoice; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Could not save invoice.");
      if (body.invoice) setInvoice(body.invoice);
      setMessage("Invoice saved.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save invoice.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function emailInvoice(target: "customer-and-office" | "office") {
    if (!(await save())) return;
    setWorking(true);
    try {
      const response = await fetch(`${endpoint}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const body = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Could not email invoice.");
      setMessage(body.message || "Invoice emailed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not email invoice.");
    } finally {
      setWorking(false);
    }
  }

  async function printInvoice(copy: "customer" | "office") {
    const printWindow = window.open("about:blank", "_blank");
    if (!(await save())) {
      printWindow?.close();
      return;
    }
    const url = `/admin/invoices/${kind}/${encodeURIComponent(bookingId)}?copy=${copy}`;
    if (printWindow) printWindow.location.href = url;
    else router.push(url);
  }

  async function previewEmail() {
    const previewWindow = window.open("about:blank", "_blank");
    if (!(await save())) {
      previewWindow?.close();
      return;
    }
    const url = `/admin/invoices/${kind}/${encodeURIComponent(bookingId)}/email-preview`;
    if (previewWindow) previewWindow.location.href = url;
    else router.push(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={openInvoice}
        className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
      >
        <ReceiptText className="h-4 w-4" aria-hidden="true" /> {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5 print:hidden">
          <div className="mx-auto max-w-5xl rounded-2xl bg-slate-100 shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-300 bg-white px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-indigo-700">Customer card invoice</p>
                <h2 className="text-xl font-black text-slate-950">{kind === "standalone" ? "Standalone invoice" : `Booking #${bookingId}`}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={working || !invoice} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"><Save className="h-4 w-4" /> Save</button>
                <button type="button" disabled={working || !invoice} onClick={() => printInvoice("customer")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"><Printer className="h-4 w-4" /> Print customer copy</button>
                <button type="button" disabled={working || !invoice} onClick={() => printInvoice("office")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"><Printer className="h-4 w-4" /> Print office copy</button>
                <button type="button" disabled={working || !invoice} onClick={previewEmail} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"><Eye className="h-4 w-4" /> Email preview</button>
                <button type="button" disabled={working || !invoice} onClick={() => emailInvoice("customer-and-office")} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50"><Mail className="h-4 w-4" /> Email customer + office</button>
                <button type="button" disabled={working || !invoice} onClick={() => emailInvoice("office")} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"><Mail className="h-4 w-4" /> Email office only</button>
                <button type="button" aria-label="Close invoice" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {loading ? <p className="p-10 text-center font-bold text-slate-600">Loading customer and booking details…</p> : null}
            {message ? <p className="mx-4 mt-4 rounded-lg bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900" aria-live="polite">{message}</p> : null}
            {invoice ? (
              <div className="m-2 bg-white p-5 text-slate-950 shadow-sm sm:m-5 sm:p-8">
                <header className="grid gap-5 border-t-8 border-sky-950 border-b-4 border-b-rose-500 py-5 sm:grid-cols-[1fr_180px]">
                  <div>
                    <Image src="/logo.png" alt="Jumping Jax" width={260} height={96} className="max-h-24 max-w-[260px] object-contain object-left" />
                    <p className="mt-2 text-sm font-semibold text-slate-600">559 Beaudrot Road, Greenwood, SC<br />864-933-1420 · info@jumpingjaxllc.com<br />jumpingjaxllc.com</p>
                  </div>
                  <div className="relative min-h-32 overflow-hidden rounded-xl">
                    <Image src="/hero.jpg" alt="Jumping Jax waterslide" fill sizes="180px" className="object-cover" />
                    <span className="absolute right-0 top-0 bg-rose-500 px-3 py-2 text-lg font-black text-white">INVOICE</span>
                  </div>
                </header>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-black uppercase text-sky-950">Invoice #<input className={inputClass} value={invoice.invoiceNumber} onChange={(event) => patch({ invoiceNumber: event.target.value })} /></label>
                  <label className="text-xs font-black uppercase text-sky-950">Invoice date<input className={inputClass} type="date" value={invoice.invoiceDate} onChange={(event) => patch({ invoiceDate: event.target.value })} /></label>
                  <label className="text-xs font-black uppercase text-sky-950">Due date<input className={inputClass} type="date" value={invoice.dueDate} onChange={(event) => patch({ dueDate: event.target.value })} /></label>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <section>
                    <h3 className="bg-sky-950 px-3 py-2 text-xs font-black uppercase text-white">Bill to</h3>
                    <div className="space-y-2 border border-slate-200 p-3">
                      <input aria-label="Customer name" className={inputClass} value={invoice.customerName} onChange={(event) => patch({ customerName: event.target.value })} />
                      <input aria-label="Customer email" className={inputClass} type="email" value={invoice.customerEmail} onChange={(event) => patch({ customerEmail: event.target.value })} />
                      <input aria-label="Customer phone" className={inputClass} value={invoice.customerPhone} onChange={(event) => patch({ customerPhone: event.target.value })} />
                      <textarea aria-label="Billing address" className={inputClass} rows={2} value={invoice.billingAddress} onChange={(event) => patch({ billingAddress: event.target.value })} />
                    </div>
                  </section>
                  <section>
                    <h3 className="bg-sky-950 px-3 py-2 text-xs font-black uppercase text-white">Event / delivery details</h3>
                    <div className="space-y-2 border border-slate-200 p-3">
                      <input aria-label="Event date" className={inputClass} value={invoice.eventDate} onChange={(event) => patch({ eventDate: event.target.value })} />
                      <textarea aria-label="Event address" className={inputClass} rows={2} value={invoice.eventAddress} onChange={(event) => patch({ eventAddress: event.target.value })} />
                      <textarea aria-label="Event details" className={inputClass} rows={2} value={invoice.eventDetails} onChange={(event) => patch({ eventDetails: event.target.value })} />
                    </div>
                  </section>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[650px] border-collapse">
                    <thead><tr className="bg-sky-950 text-left text-xs uppercase text-white"><th className="p-3">Description</th><th className="w-24 p-3 text-center">Qty</th><th className="w-40 p-3 text-right">Unit price</th><th className="w-40 p-3 text-right">Amount</th><th className="w-12"><span className="sr-only">Remove</span></th></tr></thead>
                    <tbody>{invoice.lineItems.map((line, index) => (
                      <tr key={line.id} className="border-b border-slate-200">
                        <td className="p-1"><input className={inputClass} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></td>
                        <td className="p-1"><input aria-label={`Quantity for ${line.description}`} className={`${inputClass} text-center`} type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></td>
                        <td className="p-1"><input aria-label={`Unit price for ${line.description}`} className={`${inputClass} text-right`} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} /></td>
                        <td className="p-3 text-right font-black text-sky-950">{formatMoney(line.quantity * line.unitPrice)}</td>
                        <td><button type="button" aria-label={`Remove ${line.description}`} disabled={invoice.lineItems.length === 1} onClick={() => removeLine(index)} className="rounded p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <button type="button" onClick={addLine} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-black text-slate-800 hover:bg-slate-50"><Plus className="h-4 w-4" /> Add rental or service</button>

                <div className="mt-5 grid gap-5 md:grid-cols-[1fr_330px]">
                  <div>
                    <label className="text-xs font-black uppercase text-sky-950">Notes<textarea className={inputClass} rows={4} value={invoice.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
                    <div className="mt-5 border-l-4 border-rose-500 px-4 py-2 text-sm"><strong className="text-sky-950">REMIT PAYMENT TO</strong><br />Jumping Jax LLC<br />86 Brock Road<br />Honea Path, SC 29654<br /><span className="mt-2 inline-block font-bold">Payment due by the due date shown above. Make checks payable to Jumping Jax LLC and include the invoice number.</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b p-2 text-sm font-bold"><span>Subtotal</span><span>{formatMoney(totals?.subtotal ?? 0)}</span></div>
                    {([['deliveryFee', 'Delivery fee'], ['discount', 'Discount'], ['tax', 'Sales tax'], ['paymentsReceived', 'Payments received']] as const).map(([field, label]) => (
                      <label key={field} className="grid grid-cols-[1fr_130px] items-center gap-2 border-b py-1 text-sm font-bold"><span className="text-right">{label}</span><input className={`${inputClass} mt-0 text-right`} type="number" min="0" step="0.01" value={invoice[field]} onChange={(event) => patch({ [field]: Number(event.target.value) })} /></label>
                    ))}
                    <div className="flex justify-between bg-sky-950 p-3 text-lg font-black text-white"><span>Balance due</span><span>{formatMoney(totals?.balanceDue ?? 0)}</span></div>
                  </div>
                </div>
                <p className="mt-6 bg-sky-50 p-4 text-center text-xl font-black text-rose-500">Thank you for your business!</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
