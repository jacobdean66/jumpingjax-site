import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "@/app/admin/_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { listDailyPaymentReports, loadDailyPaymentReport } from "@/lib/payments/daily-report-store";
import { reportDate, type DailyPaymentReport } from "@/lib/payments/daily-report";

export const dynamic = "force-dynamic";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export default async function DailyPaymentReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const query = await searchParams;
  const date = query.date;
  const online = query.channel === "online";
  let reports: DailyPaymentReport[] | null = null;
  let invalidDate = false;
  try {
    if (date !== undefined) {
      const checked = reportDate.safeParse(date);
      if (!checked.success) invalidDate = true;
      else { const report = await loadDailyPaymentReport(checked.data); reports = report ? [report] : []; }
    } else reports = await listDailyPaymentReports();
  } catch { /* A failed load must never be presented as a zero-sales day. */ }
  return <AdminShell>
    <AdminHeader eyebrow="Billing" title={online ? "Online link payments" : "Daily payment reports"}><AdminNav token="" role={auth.role} active="invoices" /></AdminHeader>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-slate-600">SwipeSimple snapshots collected at 5:30 p.m. Eastern, with recovery when needed. Each report shows its actual export time; later payments are not included.</p><Link href="/admin/invoices" className="rounded-full bg-sky-950 px-5 py-3 text-sm font-black text-white">Back to invoices</Link></div>
    <Link href={online ? "/admin/invoices/payment-reports" : "/admin/invoices/payment-reports?channel=online"} className="mt-5 flex items-center gap-3 rounded-3xl border-4 border-pink-600 bg-pink-400 p-5 font-black text-slate-950"><span aria-hidden="true" className="text-3xl">📁</span>{online ? "View all daily payment reports" : "Online link payments"}</Link>
    {online && <p className="mt-3 text-sm text-slate-600">Approved sales marked Payment Link by SwipeSimple. These are included in the main report totals and are not counted again. Names are shown only when supplied by SwipeSimple.</p>}
    <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4" action="/admin/invoices/payment-reports">{online && <input type="hidden" name="channel" value="online" />}<label className="grid gap-1 text-sm font-bold">Report date<input type="date" name="date" required defaultValue={typeof date === "string" ? date : ""} className="rounded-xl border border-slate-300 p-2" /></label><button className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white">Find report</button><Link href={online ? "/admin/invoices/payment-reports?channel=online" : "/admin/invoices/payment-reports"} className="p-2 text-sm underline">Latest 60 reports</Link></form>
    {invalidDate ? <p role="alert" className="mt-6 text-rose-800">Choose a valid report date.</p> : reports === null ? <p role="alert" className="mt-6 rounded-2xl bg-rose-50 p-6 text-rose-800">Reports could not be loaded. Reload to retry.</p> : reports.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed p-6">No verified report is saved for this selection. Missing data does not mean zero sales.</p> : <div className="mt-6 space-y-5">{reports.map(report => <article key={`${report.date}-${report.source_sha256}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{report.date}</h2><p className="mt-1 text-sm text-slate-600">Exported {report.snapshot_at} · {report.approved_sales_count} approved sales</p></div><div className="flex flex-wrap gap-2">{(["pdf", "csv"] as const).map(format => <a key={format} href={`/api/admin/invoices/payment-reports/${report.date}?format=${format}&version=${report.source_sha256}`} className="rounded-full bg-sky-950 px-4 py-2 text-sm font-bold text-white">{format === "pdf" ? "Open / print Letter PDF" : "Download original CSV"}</a>)}</div></div>
      {online ? <section className="mt-5 rounded-2xl border-2 border-pink-400 bg-pink-50 p-4"><h3 className="text-xl font-black">Online link total: {money(report.online_link_total_cents)}</h3>{report.online_link_payments.length ? <div className="mt-4 grid gap-3">{report.online_link_payments.map(payment=><article key={payment.transaction} className="rounded-xl border border-pink-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-bold">{payment.payer || "Name unavailable"}</h4><strong>{money(payment.amount_cents)}</strong></div><p className="mt-1 text-sm">{payment.time} · Receipt {payment.transaction}</p><p className="mt-1 text-sm text-slate-600">{payment.reference || "No reference supplied"} · {payment.category}</p></article>)}</div> : <p className="mt-3 text-sm">No approved Payment Link sales appear in this verified snapshot.</p>}</section> : <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(report.categories).map(([heading, value]) => <div key={heading} className="rounded-2xl bg-slate-50 p-4"><dt className="text-sm text-slate-600">{heading}</dt><dd className="mt-1 text-xl font-black">{money(value)}</dd></div>)}</dl>}
      <p className="mt-4 font-bold">Approved sales {money(report.sales_cents)} · Refunds {money(report.refunds_cents)} · Processor net {money(report.net_cents)}</p>
      <p className="mt-2 text-sm text-slate-600">Amount-based categories are suggestions. References take priority. Participant counts and booking paid status are not inferred. Processor net is not a bank payout.</p>
      <section className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><h3 className="font-bold">Qwen review {report.qwen.status === "reviewed" ? `· ${report.qwen.model}` : "unavailable"}</h3>{report.qwen.status === "reviewed" ? <><p className="mt-1 text-xs text-slate-600">AI review notes; verified totals above remain authoritative.</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{report.qwen.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></> : <p className="mt-1 text-sm">The verified report is available. Qwen did not return a usable review for this version.</p>}</section>
    </article>)}</div>}
  </AdminShell>;
}
