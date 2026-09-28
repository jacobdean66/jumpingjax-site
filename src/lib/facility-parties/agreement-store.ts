import { loadBookingPaymentMap } from "@/lib/payments/store";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatStoredFacilityAddons } from "@/lib/facility-parties/addons";
import {
  agreementToken,
  buildFacilityAgreementSnapshot,
  hashAgreementToken,
  type AdminAgreementSummary,
  type AgreementPayment,
  type FacilityAgreementSnapshot,
} from "./agreement";

type PrintableBookingRow = {
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
  child_age: string | null;
  child_gender: string | null;
  party_theme: string | null;
  balloon_colors: string | null;
  table_cloth_colors: string | null;
  drink_choice: string | null;
  payment_method: string | null;
  notes: string | null;
};

function clean(value: string | null): string | null {
  return value?.trim() || null;
}

function numeric(value: number | string | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

export async function loadAgreementHistoryForBookings(bookingIds: string[]) {
  const agreementMap = new Map<string, AdminAgreementSummary[]>();
  const paymentMap = new Map<string, AgreementPayment[]>();
  if (bookingIds.length === 0) return { agreementMap, paymentMap };

  const supabase = createServiceRoleClient();
  const [{ data: agreements, error: agreementError }, ledger] =
    await Promise.all([
      supabase
        .from("facility_party_agreements")
        .select("id,booking_id,version,status,email_status,snapshot,created_at,sent_at,signed_at,signer_legal_name")
        .in("booking_id", bookingIds)
        .order("version", { ascending: false }),
      loadBookingPaymentMap("facility", bookingIds),
    ]);

  // Production may briefly run the new code before its migration is applied.
  // Keep the existing dashboard available while surfacing no agreement history.
  if (agreementError && agreementError.code !== "42P01") {
    console.error("[facility-agreements] agreement history load failed", agreementError.code);
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

  for (const [bookingId, entries] of ledger) {
    paymentMap.set(bookingId, entries.filter(e => e.status === "posted").map(e => ({
      id: e.id, amount: e.amountCents / 100, paymentKind: e.paymentPurpose,
      paymentMethod: e.paymentMethod, paidAt: e.paidAt, posReceiptNumber: e.processorReference,
      recordedBy: e.recordedBy, notes: e.notes,
    })));
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

export async function loadCurrentPrintableAgreement(bookingId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select("id,status,customer_name,email,phone,parent_name,child_name,party_label,readable_date,readable_time,room,party_kind,facility_package_price,addon_subtotal,subtotal,tax,addon_selections,child_age,child_gender,party_theme,balloon_colors,table_cloth_colors,drink_choice,payment_method,notes")
    .eq("id", bookingId)
    .maybeSingle<PrintableBookingRow>();
  if (error) throw new Error("printable_agreement_lookup_failed");
  if (!data) return null;

  const { agreementMap, paymentMap } = await loadAgreementHistoryForBookings([bookingId]);
  const payments = paymentMap.get(bookingId) ?? [];
  const latestActiveAgreement = agreementMap
    .get(bookingId)
    ?.find((agreement) => agreement.status !== "superseded");
  const snapshot = buildFacilityAgreementSnapshot({
    booking: {
      id: data.id,
      customerName: clean(data.customer_name) ?? "Guest",
      email: clean(data.email),
      phone: clean(data.phone),
      parentName: clean(data.parent_name),
      childName: clean(data.child_name),
      partyLabel: clean(data.party_label),
      readableDate: clean(data.readable_date),
      readableTime: clean(data.readable_time),
      room: clean(data.room),
      partyKind: clean(data.party_kind),
      facilityPackagePrice: numeric(data.facility_package_price),
      addonSubtotal: numeric(data.addon_subtotal),
      subtotal: numeric(data.subtotal),
      tax: numeric(data.tax),
      addonText: formatStoredFacilityAddons(data.addon_selections),
    },
    additionalChildrenAge3Plus: latestActiveAgreement?.snapshot.additionalChildrenAge3Plus ?? 0,
    additionalChildrenAge2Under: latestActiveAgreement?.snapshot.additionalChildrenAge2Under ?? 0,
  });
  const paidTotal = Math.round(payments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100;
  return {
    snapshot: {
      ...snapshot,
      payments,
      paidTotal,
      balanceDue: Math.max(Math.round((snapshot.total - paidTotal) * 100) / 100, 0),
    },
    details: {
      status: data.status,
      childAge: clean(data.child_age),
      childGender: clean(data.child_gender),
      partyTheme: clean(data.party_theme),
      balloonColors: clean(data.balloon_colors),
      tableClothColors: clean(data.table_cloth_colors),
      drinkChoice: clean(data.drink_choice),
      expectedPaymentMethod: clean(data.payment_method),
      notes: clean(data.notes),
    },
  };
}
