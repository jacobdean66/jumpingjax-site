import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { resolveRentalEmailSiteUrl } from "@/lib/rentals/rental-site-url";
import { agreementToken, hashToken } from "./security";
import { customerAgreementPath, loadAgreementById, loadBookingAgreementContext } from "./store";
import { normalizeAgreementEmail, validAgreementEmail } from "./workflow";

export class AgreementActionError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export async function prepareRentalAgreement(bookingId: string, requestId: string, actor: string) {
  const context = await loadBookingAgreementContext(bookingId);
  if (!context || !["pending", "approved"].includes(context.status)) throw new AgreementActionError("This rental cannot receive a new agreement.");
  const snapshot = { ...context.snapshot, additionalTerms: context.history[0]?.snapshot.additionalTerms ?? "" };
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("ensure_rental_agreement_for_booking", {
    p_id: requestId, p_booking_id: bookingId, p_token_hash: hashToken(agreementToken(requestId)), p_snapshot: snapshot, p_created_by: actor,
  });
  if (error || !["created", "existing", "signed"].includes(data?.outcome)) throw new AgreementActionError("The booking changed or the agreement could not be prepared. Reload and try again.");
  const agreement = await loadAgreementById(bookingId, data.id);
  if (!agreement) throw new AgreementActionError("The saved agreement could not be loaded.");
  return { agreement, path: customerAgreementPath(agreement.id), alreadySigned: data.outcome === "signed" };
}

export async function emailRentalAgreement(input: {
  bookingId: string; agreementId: string; requestId: string; signedCopy: boolean;
  expectedEmail: string; requestUrl: string;
}) {
  const db = createServiceRoleClient();
  const [agreement, bookingResult] = await Promise.all([
    loadAgreementById(input.bookingId, input.agreementId),
    db.from("bookings").select("customer_email,customer_name,status").eq("id", input.bookingId).single(),
  ]);
  if (!agreement) throw new AgreementActionError("Agreement not found.", 404);
  const booking = bookingResult.data;
  if (bookingResult.error || !booking) throw new AgreementActionError("The booking could not be loaded.");
  if (input.signedCopy ? !agreement.signed_at : agreement.status !== "awaiting_signature" || !["pending", "approved"].includes(booking.status)) {
    throw new AgreementActionError("This agreement or booking changed. Reload before sending.");
  }
  if (!validAgreementEmail(booking.customer_email)) throw new AgreementActionError("Add a valid customer email using Edit rental before sending.");
  if (normalizeAgreementEmail(input.expectedEmail) !== normalizeAgreementEmail(booking.customer_email)) throw new AgreementActionError("The customer email changed. Reload and review the recipient before sending.");
  const url = new URL(customerAgreementPath(agreement.id), resolveRentalEmailSiteUrl(input.requestUrl)).toString();
  const result = await sendDurableBookingEmail({
    supabase: db, kind: "rental", bookingId: input.bookingId,
    purpose: input.signedCopy ? "rental_signed_agreement" : "rental_agreement_signature",
    messageKey: `rental-${input.bookingId}-agreement-${agreement.id}-${input.signedCopy ? "email_signed" : "email_signing"}-${input.requestId}`,
    to: booking.customer_email.trim(), subject: input.signedCopy ? "Your signed Jumping Jax rental agreement" : "Sign your Jumping Jax rental agreement",
    text: [`Hi ${booking.customer_name},`, "", input.signedCopy ? "Here is your signed rental agreement." : "Please review your rental details and safety rules, check the acknowledgment, and type your full legal name to sign.",
      `Booking reference: ${input.bookingId}`, `Event date: ${agreement.snapshot.eventDate}`, `Equipment: ${agreement.snapshot.items.map(i => i.rental_name).join(", ")}`,
      `Agreement version: ${agreement.version}`, agreement.signed_at ? `Signed by: ${agreement.signer_legal_name}` : "",
      agreement.status === "superseded" ? "This is a previous agreement version retained for your records." : "", "", url, "", "You can view, print, or save a PDF using this link.", "Jumping Jax · 864-933-1420"].filter(Boolean).join("\n"),
  });
  const { error: auditError } = await db.from("rental_agreements").update({ email_status: result.error ? "failed" : "sent", last_emailed_at: new Date().toISOString() }).eq("id", agreement.id);
  return { ok: !result.error, agreementId: agreement.id, path: customerAgreementPath(agreement.id),
    message: result.error ? "The agreement is saved, but email failed. Retry to send the same copy."
      : auditError ? "Email sent, but its status could not be updated. Reload before retrying." : `Agreement emailed to ${booking.customer_email.trim()}.` };
}
