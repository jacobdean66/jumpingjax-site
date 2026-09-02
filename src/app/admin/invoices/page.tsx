import { randomUUID } from "node:crypto";
import Link from "next/link";

import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "@/app/admin/_components";
import { BookingInvoiceButton } from "@/app/admin/invoices/BookingInvoiceButton";
import { verifyAdminAccess } from "@/lib/admin/session";
import { createBlankStandaloneInvoice } from "@/lib/invoices/shared";
import { listStandaloneInvoices } from "@/lib/invoices/store";

export const dynamic = "force-dynamic";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default async function StandaloneInvoicesPage() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const invoices = await listStandaloneInvoices().catch(() => []);
  const blankInvoice = createBlankStandaloneInvoice(randomUUID());

  return (
    <AdminShell>
      <AdminHeader eyebrow="Billing" title="Invoices">
        <AdminNav token="" role={auth.role} active="invoices" />
      </AdminHeader>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">Standalone invoice</p>
          <h2 className="mt-2 text-3xl font-black">Create an invoice from scratch</h2>
          <p className="mt-3 max-w-2xl text-slate-600">Enter any customer, event, rental, service, price, discount, tax, or payment. Totals update automatically, and the finished invoice can be printed or emailed.</p>
          <div className="mt-6"><BookingInvoiceButton kind="standalone" bookingId={blankInvoice.bookingId} initialInvoice={blankInvoice} label="Create new invoice" /></div>
        </div>
        <aside className="rounded-3xl border border-sky-200 bg-sky-50 p-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-800">Test invoice</p>
          <h2 className="mt-2 text-xl font-black">Taylor Williams · JJ-TEST-1001</h2>
          <p className="mt-2 text-sm text-slate-600">Waterslide, tables, delivery, discount, and a recorded payment.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/admin/invoices/demo/print" target="_blank" className="rounded-full bg-sky-950 px-4 py-2 text-sm font-black text-white">See print view</Link>
            <Link href="/admin/invoices/demo/email" target="_blank" className="rounded-full border-2 border-sky-950 bg-white px-4 py-2 text-sm font-black text-sky-950">See email view</Link>
          </div>
        </aside>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-black">Saved standalone invoices</h2>
        {invoices.length === 0 ? <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">No standalone invoices have been saved yet.</p> : (
          <div className="mt-4 grid gap-3">
            {invoices.map((invoice) => (
              <article key={invoice.bookingId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div><p className="font-black">{invoice.customerName}</p><p className="text-sm text-slate-600">{invoice.invoiceNumber} · {invoice.customerEmail || "No email"} · Balance {formatMoney(invoice.balanceDue)}</p></div>
                <BookingInvoiceButton kind="standalone" bookingId={invoice.bookingId} label="Open invoice" />
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
