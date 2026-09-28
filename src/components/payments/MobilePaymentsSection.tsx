import Link from "next/link";
import { Smartphone } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/payments/booking-payments";
import { MobilePaymentForm } from "./MobilePaymentForm";

type Entry = { id: string; booking_kind: "facility" | "rental"; booking_id: string; status: string };
type Receipt = { id: string; processor_reference: string; payer_name: string; paid_at: string; amount_cents: number; processing_fee_cents: number; entry: Entry | null };
type Booking = { id: string | number; customer_name: string; start_time?: string; event_date?: string };

export async function MobilePaymentsSection({ page = 0, recentPage = 0 }: { page?: number; recentPage?: number }) {
  const db = createServiceRoleClient();
  const { data, error } = await db.from("mobile_payment_receipts")
    .select("id,processor_reference,payer_name,paid_at,amount_cents,processing_fee_cents,entry:booking_payment_entries(id,booking_kind,booking_id,status)")
    .order("paid_at", { ascending: false }).order("id").range(page * 50, page * 50 + 50);
  const receipts = (data ?? []) as unknown as Receipt[];
  const bookings = new Map<string, { name: string; href: string }>();
  for (const kind of ["facility", "rental"] as const) {
    const ids = [...new Set(receipts.flatMap(r => r.entry?.booking_kind === kind ? [r.entry.booking_id] : []))];
    if (!ids.length) continue;
    const { data: rows } = await db.from(kind === "facility" ? "facility_bookings" : "bookings")
      .select(kind === "facility" ? "id,customer_name,start_time" : "id,customer_name,event_date").in("id", ids);
    for (const row of (rows ?? []) as unknown as Booking[]) {
      const date = row.start_time ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.start_time)) : row.event_date?.slice(0, 10);
      bookings.set(`${kind}:${row.id}`, { name: row.customer_name, href: `/admin/${kind === "facility" ? "facility" : "rentals"}?status=all${date ? `&from=${date}&to=${date}` : ""}#booking-${row.id}` });
    }
  }
  const pageHref = (mobilePage: number) => `/admin/payments?page=${recentPage}&mobilePage=${mobilePage}#mobile-payments`;
  return <section id="mobile-payments" aria-labelledby="mobile-payments-heading" className="mt-6 scroll-mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
    <h2 id="mobile-payments-heading" className="flex items-center gap-2 text-xl font-black"><Smartphone className="h-5 w-5 text-emerald-700" aria-hidden="true" />Mobile Payments</h2>
    <p className="mt-2 text-sm text-slate-600">Card payments taken in the SwipeSimple phone app, including walk-ins, party deposits, and rental payments. Staff records approved receipts here; payments do not sync automatically.</p>
    <p className="mt-2 text-xs text-slate-500">Linked payments also appear in booking payment history and Recent Purchases. Each payment is credited once. Check SwipeSimple for later refunds or voids.</p>
    {error ? <p role="alert" className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Mobile payment history is temporarily unavailable. Please retry before recording a payment.</p> : <>
      <MobilePaymentForm />
      {receipts.length ? <div className="mt-4 divide-y divide-slate-200">{receipts.slice(0, 50).map(receipt => {
        const entry = receipt.entry;
        const booking = entry ? bookings.get(`${entry.booking_kind}:${entry.booking_id}`) : null;
        return <article key={receipt.id} className="py-4">
          <div className="flex flex-wrap justify-between gap-2"><strong>{receipt.payer_name}</strong><strong>{formatCents(receipt.amount_cents + receipt.processing_fee_cents)} charged</strong></div>
          <p className="mt-1 break-words text-sm text-slate-600">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(receipt.paid_at))} ET · Transaction {receipt.processor_reference}</p>
          <p className="mt-1 text-sm">{formatCents(receipt.amount_cents)} before fee · {formatCents(receipt.processing_fee_cents)} card fee</p>
          {entry ? <p className="mt-1 text-sm">{booking ? <Link className="font-bold text-blue-800 underline" href={booking.href}>{booking.name} · {entry.booking_kind === "facility" ? "Facility party" : "Rental"}</Link> : `Booking ${entry.booking_id}`} · {entry.status === "posted" ? "Included in booking payments" : `${entry.status} — not credited`}</p> : <p className="mt-1 text-sm text-slate-500">No booking linked. To apply it to a booking later, record the same transaction number on that booking.</p>}
        </article>;
      })}</div> : <p className="mt-5 text-sm text-slate-600">No mobile payments have been recorded{page ? " on this page" : " yet"}.</p>}
      <nav aria-label="Mobile payments history" className="mt-4 flex gap-4 text-sm font-bold">{page > 0 ? <Link className="underline" href={pageHref(page - 1)}>Newer mobile payments</Link> : null}{receipts.length > 50 ? <Link className="underline" href={pageHref(page + 1)}>Older mobile payments</Link> : null}</nav>
    </>}
  </section>;
}
