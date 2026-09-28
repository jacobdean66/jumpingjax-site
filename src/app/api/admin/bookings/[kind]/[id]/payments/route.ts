import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verifyAdminAccess } from "@/lib/admin/session";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import {
  FACILITY_DEPOSIT_CENTS,
  dollarsToCents,
  formatCents,
  mergeFacilityPaymentEntries,
  processingFeeCents,
  remainingBookingBalanceCents,
  sumBookingPaymentCents,
  type BookingPaymentEntry,
  type BookingPaymentKind,
  type BookingPaymentMethod,
  type FacilityLegacyPayment,
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

type BookingPaymentRow = {
  id: string;
  booking_id: string;
  entry_type: "facility_deposit" | "rental_payment";
  payment_method: BookingPaymentMethod;
  amount_cents: number;
  processing_fee_cents: number;
  processor_reference: string | null;
  recorded_by: string;
  receipt_email: string | null;
  receipt_email_sent_at: string | null;
  created_at: string;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function bookingPaymentEntryFromRow(
  row: BookingPaymentRow,
): BookingPaymentEntry {
  return {
    id: row.id,
    bookingKind: "facility",
    bookingId: String(row.booking_id),
    entryType: row.entry_type,
    paymentMethod: row.payment_method,
    amountCents: Number(row.amount_cents),
    processingFeeCents: Number(row.processing_fee_cents),
    processorReference: clean(row.processor_reference),
    recordedBy: row.recorded_by,
    receiptEmail: clean(row.receipt_email),
    receiptEmailSentAt: row.receipt_email_sent_at,
    createdAt: row.created_at,
  };
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
  const total = Number(booking.total);
  const bookingTotal = Number.isFinite(total) ? total : null;
  let existingFacilityEntries: BookingPaymentEntry[] = [];
  if (kind === "facility") {
    const [
      { data: existingBookingPayments, error: existingBookingPaymentsError },
      { data: legacyPayments, error: legacyPaymentsError },
    ] = await Promise.all([
      supabase
        .from("booking_payment_entries")
        .select("id,booking_id,entry_type,payment_method,amount_cents,processing_fee_cents,processor_reference,recorded_by,receipt_email,receipt_email_sent_at,created_at")
        .eq("booking_kind", "facility")
        .eq("booking_id", id),
      supabase
        .from("facility_party_payments")
        .select("id,amount,payment_kind,payment_method,paid_at,pos_receipt_number,recorded_by,notes")
        .eq("booking_id", id),
    ]);
    if (existingBookingPaymentsError) {
      console.error(
        "[booking-payment] facility ledger preflight failed",
        existingBookingPaymentsError.code,
      );
      return NextResponse.json(
        { ok: false, message: "Could not load this booking's payments." },
        { status: 503 },
      );
    }
    if (legacyPaymentsError) {
      console.error(
        "[booking-payment] facility legacy payment preflight failed",
        legacyPaymentsError.code,
      );
      return NextResponse.json(
        { ok: false, message: "Could not load this booking's payments." },
        { status: 503 },
      );
    }
    existingFacilityEntries = mergeFacilityPaymentEntries({
      bookingEntries: ((existingBookingPayments ?? []) as BookingPaymentRow[]).map(
        bookingPaymentEntryFromRow,
      ),
      legacyPayments: ((legacyPayments ?? []) as {
        id: string;
        amount: number | string;
        payment_kind: string;
        payment_method: string;
        paid_at: string;
        pos_receipt_number: string | null;
        recorded_by: string;
        notes: string | null;
      }[]).map((row): FacilityLegacyPayment => ({
        id: row.id,
        amount: Number(row.amount),
        paymentKind: row.payment_kind,
        paymentMethod: row.payment_method,
        paidAt: row.paid_at,
        posReceiptNumber: row.pos_receipt_number,
        recordedBy: row.recorded_by,
        notes: row.notes,
      })),
    });
    if (
      amountCents === FACILITY_DEPOSIT_CENTS &&
      existingFacilityEntries.some(
        (entry) =>
          entry.entryType === "facility_deposit",
      )
    ) {
      const paidCents = sumBookingPaymentCents(existingFacilityEntries);
      return NextResponse.json(
        {
          ok: false,
          paidCents,
          remainingCents: remainingBookingBalanceCents(bookingTotal, paidCents),
          message: "This facility deposit is already recorded for the booking.",
        },
        { status: 409 },
      );
    }
  }
  const feeCents = processingFeeCents(amountCents, paymentMethod);
  // Facility deposits share the agreement ledger; the booking ID makes card retries unique.
  const paymentInsert = kind === "facility"
    ? supabase.from("facility_party_payments").insert({
      id,
      booking_id: id,
      amount: amountCents / 100,
      payment_kind: "deposit",
      payment_method: paymentMethod,
      paid_at: new Date().toISOString(),
      pos_receipt_number: reference,
      recorded_by: auth.identity.name,
      notes: feeCents > 0 ? `Recorded card processing fee: ${formatCents(feeCents)}` : null,
    })
    : supabase.from("booking_payment_entries").insert({
      booking_kind: kind,
      booking_id: id,
      entry_type: "rental_payment",
      payment_method: paymentMethod,
      amount_cents: amountCents,
      processing_fee_cents: feeCents,
      processor_reference: reference,
      recorded_by: auth.identity.name,
      receipt_email:
        sendReceipt && customerEmail && validEmail(customerEmail)
          ? customerEmail
          : null,
    });
  const { data: entry, error: insertError } = await paymentInsert.select("id")
    .single<{ id: string }>();
  if (insertError || !entry) {
    return NextResponse.json(
      { ok: false, message: insertError?.code === "23505" ? "This facility deposit is already recorded for the booking." : "Payment could not be recorded." },
      { status: insertError?.code === "23505" ? 409 : 503 },
    );
  }

  const { data: entries, error: entriesError } = kind === "rental"
    ? await supabase.from("booking_payment_entries")
      .select("amount_cents")
      .eq("booking_kind", kind)
      .eq("booking_id", id)
    : { data: null, error: null };
  if (entriesError) {
    console.error("[booking-payment] ledger read failed", entriesError.code);
  }
  const paidCents = kind === "facility"
    ? sumBookingPaymentCents(existingFacilityEntries) + amountCents
    : sumBookingPaymentCents((entries ?? []).map((row) => ({ amountCents: Number(row.amount_cents) })));
  const remainingCents = remainingBookingBalanceCents(
    bookingTotal,
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
    if (receiptSent && kind === "rental") {
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
