import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isValidBookingId } from "@/lib/admin/booking-edit";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { resolveRentalEmailSiteUrl } from "@/lib/rentals/rental-site-url";
import { agreementToken, hashToken } from "@/lib/rental-agreements/security";
import { loadBookingAgreementContext, loadAgreementById, customerAgreementPath } from "@/lib/rental-agreements/store";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdminAccess()).ok) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { id } = await params;
  if (!isValidBookingId(id)) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  const context = await loadBookingAgreementContext(id);
  if (!context) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  return NextResponse.json(context, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const limited = rateLimit(req, { scope: "admin-rental-agreement", limit: 60, windowMs: 3600000 });
  if (limited) return limited;
  const { id } = await params;
  if (!isValidBookingId(id)) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  let body;
  try { const raw = await req.text(); if (raw.length > 40000) throw new Error(); body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid agreement request." }, { status: 400 }); }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const db = createServiceRoleClient();
  if (body?.action === "create") {
    if (!uuid.test(body.requestId ?? "") || typeof body.terms !== "string" || body.terms.trim().length < 20 || body.terms.length > 20000 || typeof body.additionalTerms !== "string" || body.additionalTerms.length > 10000) return NextResponse.json({ error: "Enter valid agreement terms." }, { status: 400 });
    const context = await loadBookingAgreementContext(id);
    if (!context || !["pending", "approved"].includes(context.status)) return NextResponse.json({ error: "This rental cannot receive a new agreement." }, { status: 409 });
    const snapshot = { ...context.snapshot, terms: body.terms.trim(), additionalTerms: body.additionalTerms.trim() };
    const { data, error } = await db.rpc("create_rental_agreement_version", { p_id: body.requestId, p_booking_id: id, p_token_hash: hashToken(agreementToken(body.requestId)), p_snapshot: snapshot, p_created_by: auth.identity.name });
    if (error || data?.outcome !== "created") return NextResponse.json({ error: "The booking changed or the agreement could not be saved. Reload and try again." }, { status: 409 });
    revalidatePath("/admin/rentals");
    return NextResponse.json({ ok: true, agreementId: data.id, path: customerAgreementPath(data.id), message: "Agreement saved. The customer must sign this new version." });
  }
  if (!uuid.test(body?.agreementId ?? "")) return NextResponse.json({ error: "Choose an agreement." }, { status: 400 });
  const agreement = await loadAgreementById(id, body.agreementId);
  if (!agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  if (body.action === "review_name") {
    if (agreement.status !== "signed") return NextResponse.json({ error: "The current agreement must be signed before reviewing the name." }, { status: 409 });
    const { data: changed, error } = await db.from("rental_agreements").update({ reviewed_by: auth.identity.name, reviewed_at: new Date().toISOString() }).eq("id", agreement.id).eq("status", "signed").select("id").maybeSingle();
    if (error || !changed) return NextResponse.json({ error: "The name review could not be saved. Reload and try again." }, { status: 409 });
    revalidatePath("/admin/rentals"); return NextResponse.json({ ok: true, message: "Signer name review recorded." });
  }
  const signedCopy = body.action === "email_signed";
  if (!signedCopy && body.action !== "email_signing") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  if ((signedCopy && !agreement.signed_at) || (!signedCopy && agreement.status !== "awaiting_signature")) return NextResponse.json({ error: "Choose a signed agreement or a current agreement awaiting signature." }, { status: 409 });
  if (!uuid.test(body.requestId ?? "")) return NextResponse.json({ error: "Reload before sending." }, { status: 400 });
  const { data: booking } = await db.from("bookings").select("customer_email,customer_name").eq("id", id).single();
  if (!booking?.customer_email) return NextResponse.json({ error: "Add a customer email first." }, { status: 409 });
  const url = new URL(customerAgreementPath(agreement.id), resolveRentalEmailSiteUrl(req.url)).toString();
  const { error } = await sendDurableBookingEmail({ supabase: db, kind: "rental", bookingId: id,
    purpose: signedCopy ? "rental_signed_agreement" : "rental_agreement_signature",
    messageKey: `rental-${id}-agreement-${agreement.id}-${body.action}-${body.requestId}`,
    to: booking.customer_email, subject: signedCopy ? "Your signed Jumping Jax rental agreement" : "Sign your Jumping Jax rental agreement",
    text: [`Hi ${booking.customer_name},`, "", signedCopy ? "Here is your signed rental agreement." : "Please review the rental details and safety rules, check the acknowledgment, and type your full legal name to sign.", `Booking reference: ${id}`, `Agreement version: ${agreement.version}`, agreement.signed_at ? `Signed by: ${agreement.signer_legal_name}` : "", agreement.status === "superseded" ? "This is a previous agreement version retained for your records." : "", "", url, "", "You can view, print, or save a PDF using this link.", "Jumping Jax · 864-933-1420"].filter(Boolean).join("\n"),
  });
  await db.from("rental_agreements").update({ email_status: error ? "failed" : "sent", last_emailed_at: new Date().toISOString() }).eq("id", agreement.id);
  revalidatePath("/admin/rentals");
  return NextResponse.json({ ok: !error, message: error ? "The agreement is saved, but email failed. Retry to send the same copy." : `Agreement emailed to ${booking.customer_email}.` }, { status: error ? 503 : 200 });
}
