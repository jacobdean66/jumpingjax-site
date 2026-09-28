import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { BookingPaymentEntry, BookingPaymentKind } from "./booking-payments";

export type BookingPaymentRow = {
  id: string; booking_kind: BookingPaymentKind; booking_id: string;
  entry_type: BookingPaymentEntry["entryType"]; payment_method: BookingPaymentEntry["paymentMethod"];
  amount_cents: number; processing_fee_cents: number; processor_reference: string | null;
  recorded_by: string; receipt_email: string | null; receipt_email_sent_at: string | null;
  created_at: string; paid_at: string; payer_name: string | null; payer_email: string | null;
  status: BookingPaymentEntry["status"]; payment_purpose: string; provider_transaction_id: string | null;
  source: string; notes: string | null;
  idempotency_key: string|null; receipt_requested_at: string|null; receipt_error_class:string|null;
};

export function paymentEntryFromRow(row: BookingPaymentRow): BookingPaymentEntry {
  return {
    id: row.id, bookingKind: row.booking_kind, bookingId: String(row.booking_id), entryType: row.entry_type,
    paymentMethod: row.payment_method, amountCents: Number(row.amount_cents), processingFeeCents: Number(row.processing_fee_cents),
    processorReference: row.processor_reference, recordedBy: row.recorded_by, receiptEmail: row.receipt_email,
    receiptEmailSentAt: row.receipt_email_sent_at, createdAt: row.created_at, paidAt: row.paid_at,
    payerName: row.payer_name, payerEmail: row.payer_email, status: row.status, paymentPurpose: row.payment_purpose,
    providerTransactionId: row.provider_transaction_id, source: row.source, notes: row.notes,
    idempotencyKey:row.idempotency_key, receiptRequestedAt:row.receipt_requested_at, receiptErrorClass:row.receipt_error_class,
  };
}

export async function loadBookingPaymentMap(kind: BookingPaymentKind, ids: string[]) {
  const result = new Map<string, BookingPaymentEntry[]>();
  if (!ids.length) return result;
  const db = createServiceRoleClient();
  for (let batch = 0; batch < ids.length; batch += 100) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("booking_payment_entries").select("*")
        .eq("booking_kind", kind).in("booking_id", ids.slice(batch, batch + 100))
        .order("paid_at", { ascending: false }).order("id").range(offset, offset + 999);
      if (error) throw new Error("Payment history could not be loaded. Do not assume this booking is unpaid.");
      for (const row of (data ?? []) as BookingPaymentRow[]) {
        const entry = paymentEntryFromRow(row);
        result.set(entry.bookingId, [...(result.get(entry.bookingId) ?? []), entry]);
      }
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  return result;
}

export type RecentPayment = BookingPaymentEntry & {
  customerName: string; childName: string | null; eventDate: string | null; bookingHref: string;
};

export async function loadRecentPayments(page = 0): Promise<RecentPayment[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db.from("booking_payment_entries").select("*")
    .order("paid_at", { ascending: false }).order("id").range(page * 50, page * 50 + 49);
  if (error) throw new Error("Payment history is unavailable. Please retry.");
  const entries = ((data ?? []) as BookingPaymentRow[]).map(paymentEntryFromRow);
  const customers = new Map<string, { name: string; child: string | null; date: string | null }>();
  for (const kind of ["facility", "rental"] as const) {
    const ids = [...new Set(entries.filter(e => e.bookingKind === kind).map(e => e.bookingId))];
    if (!ids.length) continue;
    const { data: bookings, error: loadError } = await db.from(kind === "facility" ? "facility_bookings" : "bookings")
      .select(kind === "facility" ? "id,customer_name,child_name,readable_date" : "id,customer_name,event_date").in("id", ids);
    if (loadError) throw new Error("Payment booking details are unavailable. Please retry.");
    for (const raw of bookings ?? []) {
      const b = raw as unknown as { id: string | number; customer_name: string; child_name?: string; readable_date?: string; event_date?: string };
      customers.set(`${kind}:${b.id}`, { name: b.customer_name || "Guest", child: b.child_name ?? null, date: b.readable_date ?? b.event_date ?? null });
    }
  }
  return entries.map(entry => {
    const customer = customers.get(`${entry.bookingKind}:${entry.bookingId}`);
    const date = customer?.date?.slice(0, 10);
    return { ...entry, customerName: customer?.name ?? "Booking unavailable", childName: customer?.child ?? null, eventDate: date ?? null,
      bookingHref: `/admin/${entry.bookingKind === "facility" ? "facility" : "rentals"}${date ? `?from=${date}&to=${date}&status=all` : ""}#booking-${entry.bookingId}` };
  });
}
