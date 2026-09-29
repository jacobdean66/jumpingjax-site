import Link from "next/link";
import { AdminBackButton } from "@/app/admin/AdminBackButton";
import { AdminTokenGate } from "@/app/admin/AdminTokenGate";
import { PaymentHub } from "@/components/payments/PaymentHub";
import { MobilePaymentsSection } from "@/components/payments/MobilePaymentsSection";
import { SwipeSimpleCsvImport } from "@/components/payments/SwipeSimpleCsvImport";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadRecentPayments } from "@/lib/payments/store";
import { formatCents, paymentDateLabel } from "@/lib/payments/booking-payments";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string; mobilePage?: string; page?: string }>;
};

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-md border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-rose-700">Jumping Jax Admin</p>
          <h1 className="mt-3 text-3xl font-black">Staff sign in</h1>
          {auth.reason === "invalid_token" ? <div className="mt-6"><AdminTokenGate /></div> : null}
        </section>
      </main>
    );
  }

  const page = Math.max(0, Math.min(10000, Number.parseInt(resolved?.page ?? "0", 10) || 0));
  const recent = await loadRecentPayments(page);
  const {data: unlinked, error: reviewError} = await createServiceRoleClient().from("swipesimple_transaction_imports")
    .select("transaction_id,transaction_number,amount_cents,payer_name,paid_at,review_note,invoice_number,reference")
    .is("payment_entry_id",null).ilike("result","approved").ilike("transaction_type","sale")
    .order("paid_at",{ascending:false}).limit(100);
  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <AdminBackButton />
          <div className="flex flex-wrap gap-2">
            <Link
              href="https://swipesimple.com/transactions"
              target="_blank"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black hover:bg-slate-50"
            >
              Transaction history
            </Link>
            <Link
              href="https://swipesimple.com/companies/428590/reporting?topic=transaction"
              target="_blank"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Daily reports
            </Link>
          </div>
        </div>
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <PaymentHub />
        </section>
        {auth.role === "owner" ? <SwipeSimpleCsvImport /> : null}
        <MobilePaymentsSection page={Math.max(0, Math.min(10000, Number.parseInt(resolved?.mobilePage ?? "0", 10) || 0))} recentPage={page} />
        <section className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Recent Purchases</h2>
          <p className="mt-2 text-sm text-slate-600">Recorded booking payments, including deposits. The payer and booking customer can be different people. Card fees are separate from the amount credited to the booking.</p>
          <div className="mt-4 divide-y divide-slate-200">
            {recent.length === 0 ? <p>No recorded payments on this page.</p> : recent.map(entry => <article key={entry.id} className="py-4">
              <div className="flex flex-wrap justify-between gap-2"><Link className="font-bold text-blue-800 underline" href={entry.bookingHref}>{entry.customerName}{entry.childName ? ` · ${entry.childName}` : ""}</Link><strong>{formatCents(entry.amountCents)} applied</strong></div>
              <p className="mt-1 text-sm">Paid by: <strong>{entry.payerName || "Payer not recorded"}</strong> · {paymentDateLabel(entry.paidAt)} · {entry.paymentMethod}</p>
              <p className="mt-1 text-sm text-slate-600">{entry.bookingKind} · {entry.paymentPurpose} · {entry.status === "posted" ? "Recorded" : `${entry.status} — not credited`}{entry.processorReference ? ` · Receipt ${entry.processorReference}` : ""}{entry.processingFeeCents ? ` · Fee ${formatCents(entry.processingFeeCents)}` : ""}</p>
            </article>)}
          </div>
          <nav className="mt-4 flex gap-4">{page > 0 ? <Link href={`/admin/payments?page=${page-1}`} className="underline">Newer payments</Link> : null}{recent.length === 50 ? <Link href={`/admin/payments?page=${page+1}`} className="underline">Older payments</Link> : null}</nav>
        </section>
        <section className="mt-6 rounded-md border border-amber-300 bg-white p-5">
          <h2 className="text-xl font-black">Payments needing a party match</h2>
          <p className="mt-2 text-sm">These processor receipts have not been credited to a booking. Verify the invoice number or customer contact details before recording a payment from the correct party card. An amount or name alone does not establish a match.</p>
          {reviewError ? <p className="mt-3">Review history is unavailable. Please retry.</p> : <ul className="mt-3 divide-y">{unlinked?.map(row=><li className="py-3 text-sm" key={row.transaction_id}><strong>{row.payer_name || "Payer unavailable"}</strong> · {formatCents(row.amount_cents)} charged · {paymentDateLabel(row.paid_at)}<br/><a className="text-blue-800 underline" href={`https://swipesimple.com/transactions/${encodeURIComponent(row.transaction_id)}`} target="_blank" rel="noreferrer">Receipt {row.transaction_number}</a>{row.invoice_number ? ` · Invoice ${row.invoice_number}` : ""}{row.reference ? ` · ${row.reference}` : ""}{row.review_note ? <p>{row.review_note}</p> : null}</li>)}</ul>}
          {!reviewError && !unlinked?.length ? <p className="mt-3">No imported receipts awaiting a match.</p> : null}
        </section>
        <section className="mt-6 border-l-4 border-amber-400 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm">
          <h2 className="font-black text-slate-950">Front-counter recordkeeping</h2>
          <p className="mt-2">
            SwipeSimple records every swipe, tap, keyed sale, cash sale, refund,
            and adjustment. Use Transaction History or Daily Reports for the live
            official total. The Jumping Jax site cannot automatically read those
            transactions. Since SwipeSimple does not provide this account an API,
            export Transaction History as CSV and upload it above to reconcile the
            processor report with booking payments.
          </p>
        </section>
      </div>
    </main>
  );
}
