export type RentalAgreementTemplate = { version: number; title: string; terms: string; updated_at: string; updated_by: string };

export type RentalAgreementSnapshot = {
  businessName: string; businessPhone: string; businessEmail: string;
  customerName: string; email: string; phone: string;
  items: { rental_item: string; rental_name: string }[];
  eventDate: string; duration: string; foamDuration: string; spanDays: number;
  eventAddress: string; deliveryWindow: string; eventStartTime: string; pickup: string;
  setupLocation: string; setupSurface: string; setupAccess: string; setupNotes: string;
  paymentMethod: string; subtotal: number; deliveryFee: number; total: number;
  paidTotal: number; balanceDue: number; pricingLabel: string;
  title: string; terms: string; templateVersion: number; additionalTerms: string;
  bookingState?: Record<string, unknown>;
};

export type RentalAgreement = {
  id: string; booking_id: string; version: number; status: "awaiting_signature" | "signed" | "superseded";
  snapshot: RentalAgreementSnapshot; created_at: string; signed_at: string | null;
  signer_legal_name: string | null; acknowledged: boolean;
  email_status: "not_sent" | "sent" | "failed"; last_emailed_at: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
};

export function normalizeSignerName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function signerNameMatches(customer: string, signer: string | null): boolean {
  return Boolean(signer && normalizeSignerName(customer) === normalizeSignerName(signer));
}

export function validSignerName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 120
    && /\p{L}/u.test(value) && !/[\u0000-\u001f\u007f]/u.test(value);
}

export const SIGNATURE_ACKNOWLEDGMENT = "I have read, understand, and agree to this rental agreement and safety rules. I intend my typed full legal name to be my electronic signature.";
