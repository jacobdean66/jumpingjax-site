import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { formatStoredFacilityAddons } from "@/lib/facility-parties/addons";
import {
  agreementEmailText,
  agreementToken,
  buildFacilityAgreementSnapshot,
  hashAgreementToken,
} from "@/lib/facility-parties/agreement";
import { isValidBookingId } from "@/lib/admin/booking-edit";
import { verifyAdminAccess } from "@/lib/admin/session";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRentalEmailSiteUrl } from "@/lib/rentals/rental-site-url";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type BookingRow = {
  id: string;
  status: string;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  parent_name: string | null;
  child_name: string | null;
  party_label: string | null;
  readable_date: string | null;
  readable_time: string | null;
  room: string | null;
  party_kind: string | null;
  facility_package_price: number | string | null;
  addon_subtotal: number | string | null;
  subtotal: number | string | null;
  tax: number | string | null;
  addon_selections: unknown;
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boundedCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(Math.floor(parsed), 100);
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { scope: "admin-facility-agreement", limit: 30, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: "Admin authentication required." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!isValidBookingId(id)) {
    return NextResponse.json({ ok: false, message: "Invalid facility party ID." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid agreement details." }, { status: 400 });
  }

  const paymentInput = body.payment && typeof body.payment === "object"
    ? body.payment as Record<string, unknown>
    : null;
  if (paymentInput && !(Number(paymentInput.amount) > 0)) {
    return NextResponse.json({ ok: false, message: "Enter a payment amount greater than zero." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select("id,status,customer_name,email,phone,parent_name,child_name,party_label,readable_date,readable_time,room,party_kind,facility_package_price,addon_subtotal,subtotal,tax,addon_selections")
    .eq("id", id)
    .maybeSingle<BookingRow>();
  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Could not load this facility party." }, { status: error ? 503 : 404 });
  }
  if (data.status !== "confirmed") {
    return NextResponse.json({ ok: false, message: "Agreements are available after the party is confirmed." }, { status: 409 });
  }
  const email = clean(data.email);
  if (!email) {
    return NextResponse.json({ ok: false, message: "Add a customer email before sending the agreement." }, { status: 409 });
  }

  const snapshot = buildFacilityAgreementSnapshot({
    booking: {
      id: data.id,
      customerName: clean(data.customer_name) ?? "Guest",
      email,
      phone: clean(data.phone),
      parentName: clean(data.parent_name),
      childName: clean(data.child_name),
      partyLabel: clean(data.party_label),
      readableDate: clean(data.readable_date),
      readableTime: clean(data.readable_time),
      room: clean(data.room),
      partyKind: clean(data.party_kind),
      facilityPackagePrice: money(data.facility_package_price),
      addonSubtotal: money(data.addon_subtotal),
      subtotal: money(data.subtotal),
      tax: money(data.tax),
      addonText: formatStoredFacilityAddons(data.addon_selections),
    },
    additionalChildrenAge3Plus: boundedCount(body.additionalChildrenAge3Plus),
    additionalChildrenAge2Under: boundedCount(body.additionalChildrenAge2Under),
  });

  const agreementId = randomUUID();
  let token: string;
  try {
    token = agreementToken(agreementId);
  } catch {
    return NextResponse.json({ ok: false, message: "Agreement signing is not configured." }, { status: 503 });
  }

  const allowedKinds = new Set(["deposit", "partial", "balance", "paid_in_full", "other"]);
  const payment = paymentInput ? {
    amount: Math.round(Number(paymentInput.amount) * 100) / 100,
    payment_kind: allowedKinds.has(String(paymentInput.paymentKind)) ? String(paymentInput.paymentKind) : "other",
    payment_method: clean(paymentInput.paymentMethod) ?? "Facility POS",
    paid_at: clean(paymentInput.paidAt) && !Number.isNaN(Date.parse(String(paymentInput.paidAt)))
      ? new Date(String(paymentInput.paidAt)).toISOString()
      : new Date().toISOString(),
    pos_receipt_number: clean(paymentInput.posReceiptNumber),
    notes: clean(paymentInput.notes),
  } : null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_facility_party_agreement_version",
    {
      p_agreement_id: agreementId,
      p_booking_id: id,
      p_public_token_hash: hashAgreementToken(token),
      p_created_by: auth.identity.name,
      p_snapshot: snapshot,
      p_payment: payment,
    },
  );
  const result = rpcData as { outcome?: string; version?: number; snapshot?: typeof snapshot } | null;
  if (rpcError || result?.outcome !== "created" || !result.version || !result.snapshot) {
    console.error("[facility-agreement] create failed", rpcError?.code ?? result?.outcome);
    return NextResponse.json({ ok: false, message: "The payment and agreement could not be saved." }, { status: 503 });
  }

  const url = new URL(`/facility-party-agreement/${token}`, resolveRentalEmailSiteUrl(req.url)).toString();
  const { error: emailError } = await sendDurableBookingEmail({
    supabase,
    messageKey: `facility-${id}-agreement-${agreementId}-v1`,
    kind: "facility",
    bookingId: id,
    purpose: "party_agreement_signature",
    to: email,
    subject: "Sign your Jumping Jax birthday party agreement",
    text: agreementEmailText({ snapshot: result.snapshot, url, version: result.version }),
  });
  await supabase
    .from("facility_party_agreements")
    .update({
      email_status: emailError ? "failed" : "sent",
      last_emailed_at: new Date().toISOString(),
    })
    .eq("id", agreementId);

  revalidatePath("/admin/facility");
  return NextResponse.json({
    ok: true,
    message: emailError
      ? "Payment saved, but the agreement email failed. Create an updated version without another payment to retry."
      : "Payment saved and the signing link was emailed to the customer.",
    agreementId,
    emailSent: !emailError,
  });
}
