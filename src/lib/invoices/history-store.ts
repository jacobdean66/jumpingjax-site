import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadBookingPaymentMap } from "@/lib/payments/store";
import { sumBookingPaymentCents } from "@/lib/payments/booking-payments";
import { money, type BookingInvoice, type InvoiceKind } from "./shared";
import { HISTORY_PAGE_SIZE, invoiceHistorySearch, type invoiceHistoryFilters } from "./history";

export async function loadInvoiceHistory(filters: ReturnType<typeof invoiceHistoryFilters>) {
  const db = createServiceRoleClient();
  let query = db.from("booking_invoices")
    .select("id,booking_kind,booking_id,invoice_number,customer_email,total,balance_due,last_emailed_at,updated_at,payload", { count: "exact" });
  if (filters.kind) query = query.eq("booking_kind", filters.kind);
  if (filters.status === "sent") query = query.not("last_emailed_at", "is", null);
  if (filters.status === "saved") query = query.is("last_emailed_at", null);
  if (filters.q) query = query.or(invoiceHistorySearch(filters.q));
  const offset = (filters.page - 1) * HISTORY_PAGE_SIZE;
  const { data, error, count } = await query
    .order("last_emailed_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false }).order("id")
    .range(offset, offset + HISTORY_PAGE_SIZE - 1);
  if (error) throw new Error("Invoice history could not be loaded. Please retry.");
  const rows = (data ?? []).map(row => {
    const payload = row.payload as Partial<BookingInvoice> | null;
    return {
      id: String(row.id), kind: row.booking_kind as InvoiceKind, bookingId: String(row.booking_id),
      invoiceNumber: String(row.invoice_number), customerName: payload?.customerName?.trim() || "Unnamed customer",
      customerEmail: String(row.customer_email ?? ""), total: money(row.total), balanceDue: money(row.balance_due),
      lastEmailedAt: row.last_emailed_at as string | null, updatedAt: String(row.updated_at),
    };
  });
  // Booking payments can change after an invoice is saved or emailed.
  for (const kind of ["rental", "facility"] as const) {
    const ids = rows.filter(row => row.kind === kind).map(row => row.bookingId);
    const payments = await loadBookingPaymentMap(kind, ids);
    for (const row of rows.filter(row => row.kind === kind)) {
      row.balanceDue = money(Math.max(0, row.total - sumBookingPaymentCents(payments.get(row.bookingId) ?? []) / 100));
    }
  }
  return { rows, count: count ?? 0 };
}
