import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "@/app/admin/_components";
import { verifyAdminAccess } from "@/lib/admin/session";
import { HISTORY_PAGE_SIZE, invoiceHistoryFilters } from "@/lib/invoices/history";
import { loadInvoiceHistory } from "@/lib/invoices/history-store";
import { BookingInvoiceButton } from "../BookingInvoiceButton";

export const dynamic = "force-dynamic";
const currency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const timestamp = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function InvoiceHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const filters = invoiceHistoryFilters(await searchParams);
  let result: Awaited<ReturnType<typeof loadInvoiceHistory>> | null = null;
  try { result = await loadInvoiceHistory(filters); } catch { /* Show failure distinctly from an empty history. */ }
  const pageHref = (page: number) => `/admin/invoices/history?${new URLSearchParams({ q: filters.q, kind: filters.kind, status: filters.status, page: String(page) })}`;
  const control = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm";
  return <AdminShell>
    <AdminHeader eyebrow="Billing" title="Invoice history"><AdminNav token="" role={auth.role} active="invoices" /></AdminHeader>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-3xl text-sm text-slate-600">Saved rental, facility, and standalone invoices. Sent dates show the most recent email, including office copies, in Eastern time. A sent date records email submission, not confirmed delivery.</p>
      <Link href="/admin/invoices" className="rounded-full bg-sky-950 px-4 py-2 text-sm font-black text-white">Create invoice</Link>
    </div>
    <form action="/admin/invoices/history" className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-bold">Search<input name="q" defaultValue={filters.q} maxLength={100} placeholder="Customer, email, or invoice number" className={control} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Invoice type<select name="kind" defaultValue={filters.kind} className={control}><option value="">All types</option><option value="rental">Rental</option><option value="facility">Facility</option><option value="standalone">Standalone</option></select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Email status<select name="status" defaultValue={filters.status} className={control}><option value="all">All invoices</option><option value="sent">Sent</option><option value="saved">No recorded send</option></select></label>
      <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white">Apply filters</button>
      <Link href="/admin/invoices/history" className="px-2 py-2 text-sm font-bold text-slate-600 underline">Reset</Link>
    </form>
    {!result ? <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">Invoice history could not be loaded. Please reload this page to retry.</p> : <>
      <p className="mt-6 text-sm font-bold text-slate-600">{result.count} {result.count === 1 ? "invoice" : "invoices"} · Page {filters.page} of {Math.max(1, Math.ceil(result.count / HISTORY_PAGE_SIZE))}</p>
      {result.rows.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">No invoices match these filters.</p> : <div className="mt-4 grid gap-3">
        {result.rows.map(row => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-wide text-indigo-700">{row.kind} invoice</p><h2 className="mt-1 break-words text-xl font-black">{row.customerName}</h2><p className="mt-1 break-all text-sm text-slate-600">{row.invoiceNumber} · {row.customerEmail || "No customer email"}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.lastEmailedAt ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{row.lastEmailedAt ? "Sent" : "No recorded send"}</span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-slate-500">Last emailed</dt><dd className="font-bold">{row.lastEmailedAt ? timestamp(row.lastEmailedAt) : "No recorded send"}</dd></div>
            <div><dt className="text-slate-500">Last saved</dt><dd className="font-bold">{timestamp(row.updatedAt)}</dd></div>
            <div><dt className="text-slate-500">Invoice total</dt><dd className="font-bold">{currency(row.total)}</dd></div>
            <div><dt className="text-slate-500">Current balance</dt><dd className="font-bold">{currency(row.balanceDue)}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3"><BookingInvoiceButton kind={row.kind} bookingId={row.bookingId} label="Open invoice" /><Link href={`/admin/invoices/${row.kind}/${encodeURIComponent(row.bookingId)}`} target="_blank" className="text-sm font-bold text-sky-800 underline">Print invoice</Link></div>
        </article>)}
      </div>}
      <nav aria-label="Invoice history pages" className="mt-6 flex gap-4">{filters.page > 1 && <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold" href={pageHref(filters.page - 1)}>Previous</Link>}{filters.page * HISTORY_PAGE_SIZE < result.count && <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold" href={pageHref(filters.page + 1)}>Next</Link>}</nav>
    </>}
  </AdminShell>;
}
