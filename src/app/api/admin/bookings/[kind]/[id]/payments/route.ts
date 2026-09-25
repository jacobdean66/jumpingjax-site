import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verifyAdminAccess } from "@/lib/admin/session";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import {
  FACILITY_DEPOSIT_CENTS,
  dollarsToCents,
  formatCents,
  processingFeeCents,
  remainingBookingBalanceCents,
  sumBookingPaymentCents,
  type BookingPaymentKind,
  type BookingPaymentMethod,
} from "@/lib/payments/booking-payments";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const METHODS = new Set<BookingPaymentMethod>([
  "card",
  "cash",
  "check",
  "other",
]);

function validBookingId(value: string): boolean {
  return /^[a-zA-Z0-9-]{1,80}$/.test(value);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-booking-payment",
    limit: 80,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: "Admin authentication required." },
      { status: 401 },
    );
  }

  const { kind: rawKind, id } = await context.params;
  if ((rawKind !== "facility" && rawKind !== "rental") || !validBookingId(id)) {
    return NextResponse.json(
      { ok: false, message: "Invalid booking." },
      { status: 400 },
    );
  }
  const kind = rawKind as BookingPaymentKind;
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const method =
    typeof body?.paymentMethod === "string" ? body.paymentMethod : "";
  const paymentMethod = METHODS.has(method as BookingPaymentMethod)
    ? (method as BookingPaymentMethod)
    : null;
  const amountCents = dollarsToCents(body?.amount);
  const reference =
    typeof body?.reference === "string"
      ? body.reference.trim().slice(0, 120) || null
      : null;
  const sendReceipt = body?.sendReceipt === true;
  if (!paymentMethod || !amountCents) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid payment amount and method." },
      { status: 400 },
    );
  }
  if (kind === "facility" && amountCents !== FACILITY_DEPOSIT_CENTS) {
    return NextResponse.json(
      { ok: false, message: "Facility deposits must be recorded as $50.00." },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const bookingTable = kind === "facility" ? "facility_bookings" : "bookings";
  const emailColumn = kind === "facility" ? "email" : "customer_email";
  const { data: booking, error: bookingError } = await supabase
    .from(bookingTable)
    .select(`id, customer_name, ${emailColumn}, total`)
    .eq("id", id)
    .maybeSingle<{
      id: string | number;
      customer_name: string | null;
      email?: string | null;
      customer_email?: string | null;
      total: number | string | null;
    }>();
  if (bookingError) {
    return NextResponse.json(
      { ok: false, message: "Could not load this booking." },
      { status: 503 },
    );
  }
  if (!booking) {
    return NextResponse.json(
      { ok: false, message: "Booking not found." },
      { status: 404 },
    );
  }

  const customerEmail =
    (kind === "facility" ? booking.email : booking.customer_email)?.trim() ||
    null;
  const feeCents = processingFeeCents(amountCents, paymentMethod);
  const entryType = kind === "facility" ? "facility_deposit" : "rental_payment";
  const { data: entry, error: insertError } = await supabase
    .from("booking_payment_entries")
    .insert({
      booking_kind: kind,
      booking_id: id,
      entry_type: entryType,
      payment_method: paymentMethod,
      amount_cents: amountCents,
      processing_fee_cents: feeCents,
      processor_reference: reference,
      recorded_by: auth.identity.name,
      receipt_email:
        sendReceipt && customerEmail && validEmail(customerEmail)
          ? customerEmail
          : null,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !entry) {
    return NextResponse.json(
      { ok: false, message: "Payment could not be recorded." },
      { status: 503 },
    );
  }

  const { data: entries, error: entriesError } = await supabase
    .from("booking_payment_entries")
    .select("amount_cents")
    .eq("booking_kind", kind)
    .eq("booking_id", id);
  if (entriesError) {
    console.error("[booking-payment] ledger read failed", entriesError.code);
  }
  const paidCents = sumBookingPaymentCents(
    (entries ?? []).map((row) => ({ amountCents: Number(row.amount_cents) })),
  );
  const total = Number(booking.total);
  const remainingCents = remainingBookingBalanceCents(
    Number.isFinite(total) ? total : null,
    paidCents,
  );

  let receiptSent = false;
  if (sendReceipt && customerEmail && validEmail(customerEmail)) {
    const paymentLabel =
      kind === "facility" ? "facility party deposit" : "rental payment";
    const chargeLine =
      feeCents > 0
        ? `\nCard processing fee: ${formatCents(feeCents)}\nCard charged: ${formatCents(amountCents + feeCents)}`
        : "";
    const balanceLine =
      remainingCents === null
        ? ""
        : `\nRemaining booking balance: ${formatCents(remainingCents)}`;
    const receipt = await sendDurableBookingEmail({
      supabase,
      messageKey: `booking-payment-receipt-${entry.id}`,
      kind,
      bookingId: id,
      purpose: "payment_receipt",
      to: customerEmail,
      subject: `Jumping Jax payment receipt - booking #${id}`,
      text: `Hello ${booking.customer_name?.trim() || "there"},\n\nWe recorded your ${paymentLabel} for booking #${id}.\n\nPayment applied to your booking: ${formatCents(amountCents)}${chargeLine}${balanceLine}\nPayment method: ${paymentMethod}${reference ? `\nReference: ${reference}` : ""}\n\nThank you,\nJumping Jax`,
    });
    receiptSent = !receipt.error;
    if (receiptSent) {
      await supabase
        .from("booking_payment_entries")
        .update({ receipt_email_sent_at: new Date().toISOString() })
        .eq("id", entry.id);
    }
  }

  revalidatePath(kind === "facility" ? "/admin/facility" : "/admin/rentals");
  revalidatePath("/admin/payments");
  return NextResponse.json({
    ok: true,
    receiptSent,
    paidCents,
    remainingCents,
    message: receiptSent
      ? "Payment recorded and receipt emailed."
      : sendReceipt
        ? "Payment recorded. The receipt could not be emailed."
        : "Payment recorded.",
  });
}
