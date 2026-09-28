import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { MOBILE_PAYMENT_MESSAGES, parseMobilePayment } from "@/lib/payments/mobile-payments";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ ok: false, message: "Staff sign-in required." }, { status: 401 });
  const limited = rateLimit(req, { scope: "admin-mobile-payment", limit: 80, windowMs: 3600000 });
  if (limited) return limited;
  let payment;
  try { payment = parseMobilePayment(await req.json()); }
  catch (error) { return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Invalid payment details." }, { status: 400 }); }
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("record_mobile_payment", { p_payment: {
    request_id: payment.requestId, processor_reference: payment.reference, payer_name: payment.payerName,
    paid_at: payment.paidAt, amount_cents: payment.amountCents, processing_fee_cents: payment.feeCents,
    booking_kind: payment.bookingKind, booking_id: payment.bookingId, payment_purpose: payment.purpose,
    recorded_by: auth.identity.name,
  } });
  if (error) return NextResponse.json({ ok: false, message: "Payment could not be confirmed. Check Mobile Payments before retrying." }, { status: 503 });
  if (!data || !["created", "duplicate", "linked"].includes(data.outcome)) {
    return NextResponse.json({ ok: false, message: MOBILE_PAYMENT_MESSAGES[data?.outcome] || "Payment was not recorded. Review the receipt and booking details." }, { status: 409 });
  }
  for (const path of ["/admin/payments", "/admin/facility", "/admin/rentals"]) revalidatePath(path);
  return NextResponse.json({ ok: true, message: data.outcome === "duplicate" ? "This mobile payment is already recorded." : data.payment_entry_id ? "Mobile payment recorded and linked to its booking." : "Mobile payment recorded." });
}

export async function GET(req: Request) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id")?.trim() ?? "";
  if (!["facility", "rental"].includes(kind ?? "") || !/^[a-z0-9-]{1,80}$/i.test(id)) return NextResponse.json({ ok: false, message: "Enter a valid booking number." }, { status: 400 });
  const { data, error } = await createServiceRoleClient().from(kind === "facility" ? "facility_bookings" : "bookings")
    .select(kind === "facility" ? "id,customer_name,child_name,readable_date,status" : "id,customer_name,event_date,status").eq("id", id).maybeSingle<{ id: string | number; customer_name: string; child_name?: string; readable_date?: string; event_date?: string; status: string | null }>();
  if (error) return NextResponse.json({ ok: false, message: "Booking lookup is unavailable." }, { status: 503 });
  if (!data || ["cancelled", "canceled", "rejected"].includes(String(data.status).toLowerCase())) return NextResponse.json({ ok: false, message: "No active booking found with that number." }, { status: 404 });
  return NextResponse.json({ ok: true, booking: data });
}
