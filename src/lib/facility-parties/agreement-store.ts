import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  agreementToken,
  hashAgreementToken,
  type AdminAgreementSummary,
  type AgreementPayment,
  type FacilityAgreementSnapshot,
} from "./agreement";

type AgreementRow = {
  id: string;
  booking_id: string;
  version: number;
  status: "sent" | "signed" | "superseded";
  email_status: "pending" | "sent" | "failed";
  snapshot: FacilityAgreementSnapshot;
  created_at: string;
  sent_at: string | null;
  signed_at: string | null;
  signer_legal_name: string | null;
};

type PaymentRow = {
  id: string;
  booking_id: string;
  amount: number | string;
  payment_kind: string;
  payment_method: string;
  paid_at: string;
  pos_receipt_number: string | null;
  recorded_by: string;
  notes: string | null;
};

export async function loadAgreementHistoryForBookings(bookingIds: string[]) {
  const agreementMap = new Map<string, AdminAgreementSummary[]>();
  const paymentMap = new Map<string, AgreementPayment[]>();
  if (bookingIds.length === 0) return { agreementMap, paymentMap };

  const supabase = createServiceRoleClient();
  const [{ data: agreements, error: agreementError }, { data: payments, error: paymentError }] =
    await Promise.all([
      supabase
        .from("facility_party_agreements")
        .select("id,booking_id,version,status,email_status,snapshot,created_at,sent_at,signed_at,signer_legal_name")
        .in("booking_id", bookingIds)
        .order("version", { ascending: false }),
      supabase
        .from("facility_party_payments")
        .select("id,booking_id,amount,payment_kind,payment_method,paid_at,pos_receipt_number,recorded_by,notes")
        .in("booking_id", bookingIds)
        .order("paid_at", { ascending: true }),
    ]);

  // Production may briefly run the new code before its migration is applied.
  // Keep the existing dashboard available while surfacing no agreement history.
  if (agreementError && agreementError.code !== "42P01") {
    console.error("[facility-agreements] agreement history load failed", agreementError.code);
  }
  if (paymentError && paymentError.code !== "42P01") {
    console.error("[facility-agreements] payment history load failed", paymentError.code);
  }

  for (const row of (agreements ?? []) as AgreementRow[]) {
    let customerSigningPath: string | null = null;
    try {
      customerSigningPath = `/facility-party-agreement/${agreementToken(row.id)}`;
    } catch {
      // Keep printable admin history available if signing is not configured.
    }
    const item: AdminAgreementSummary = {
      id: row.id,
      version: Number(row.version),
      status: row.status,
      emailStatus: row.email_status,
      snapshot: row.snapshot,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      signedAt: row.signed_at,
      signerLegalName: row.signer_legal_name,
      customerSigningPath,
    };
    agreementMap.set(row.booking_id, [...(agreementMap.get(row.booking_id) ?? []), item]);
  }

  for (const row of (payments ?? []) as PaymentRow[]) {
    const item: AgreementPayment = {
      id: row.id,
      amount: Number(row.amount),
      paymentKind: row.payment_kind,
      paymentMethod: row.payment_method,
      paidAt: row.paid_at,
      posReceiptNumber: row.pos_receipt_number,
      recordedBy: row.recorded_by,
      notes: row.notes,
    };
    paymentMap.set(row.booking_id, [...(paymentMap.get(row.booking_id) ?? []), item]);
  }
  return { agreementMap, paymentMap };
}

export async function loadAgreementByToken(token: string): Promise<AgreementRow | null> {
  if (token.length < 32 || token.length > 128) return null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_party_agreements")
    .select("id,booking_id,version,status,email_status,snapshot,created_at,sent_at,signed_at,signer_legal_name")
    .eq("public_token_hash", hashAgreementToken(token))
    .maybeSingle<AgreementRow>();
  if (error) throw new Error("agreement_lookup_failed");
  return data ?? null;
}

export async function loadAgreementById(input: { bookingId: string; agreementId: string }) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_party_agreements")
    .select("id,booking_id,version,status,email_status,snapshot,created_at,sent_at,signed_at,signer_legal_name")
    .eq("id", input.agreementId)
    .eq("booking_id", input.bookingId)
    .maybeSingle<AgreementRow>();
  if (error) throw new Error("agreement_lookup_failed");
  return data ?? null;
}
