import { signerNameMatches, type RentalAgreement } from "./types";

export type AgreementState = "missing" | "ready" | "awaiting" | "signed" | "review" | "superseded" | "failed";
export function agreementState(customerName: string, agreement?: RentalAgreement): AgreementState {
  if (!agreement) return "missing";
  if (agreement.status === "superseded") return "superseded";
  if (agreement.status === "signed") return !agreement.reviewed_at && !signerNameMatches(customerName, agreement.signer_legal_name) ? "review" : "signed";
  if (agreement.email_status === "failed") return "failed";
  return agreement.email_status === "sent" ? "awaiting" : "ready";
}
export const agreementStateLabel: Record<AgreementState, string> = {
  missing: "Agreement missing", ready: "Ready · Not sent", awaiting: "Sent · Awaiting signature",
  signed: "Signed", review: "Signed · Review name", superseded: "Needs new signature", failed: "Email failed",
};
export function canRequestAgreement(status: string, agreement?: RentalAgreement) {
  return ["pending", "approved"].includes(status) && agreement?.status !== "signed";
}
export function normalizeAgreementEmail(email: string | null | undefined) { return email?.trim().toLowerCase() ?? ""; }
export function validAgreementEmail(email: string | null | undefined) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim() ?? ""); }
export type AgreementBatchBooking = {
  id: string; customerName: string; customerEmail: string | null; eventDate: string;
  rentalNames: string; city: string; status: string; agreement?: RentalAgreement;
};
export function defaultAgreementSelection(bookings: AgreementBatchBooking[]) {
  return bookings.filter(b => canRequestAgreement(b.status, b.agreement) && validAgreementEmail(b.customerEmail)
    && b.agreement?.email_status !== "sent").map(b => b.id);
}
