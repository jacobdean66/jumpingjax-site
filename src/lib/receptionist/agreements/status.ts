import type { SupabaseClient } from "@supabase/supabase-js";
import { signerNameMatches } from "@/lib/rental-agreements/types";

export type AgreementKind = "rental" | "facility";
type SignatureState = "missing" | "awaiting_signature" | "signed" | "signed_needs_review";
type DeliveryState = "not_sent" | "sent" | "failed" | "pending";
export type AgreementStatus =
  | { kind: AgreementKind; state: "booking_not_found" | "booking_closed" }
  | { kind: AgreementKind; state: "missing" }
  | { kind: AgreementKind; state: Exclude<SignatureState, "missing">; agreementId: string; version: number; delivery: DeliveryState; freshness: "unverified" };

const uuid = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const rentalId = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value)) return false;
  return value.length < 19 || value <= "9223372036854775807";
};

/**
 * Internal status reader, not caller authentication. The trusted caller must
 * first verify authority for this exact booking. Query failures or inconsistent
 * current versions throw rather than being reported as unsigned or missing.
 */
export async function loadCurrentAgreementStatus(db: SupabaseClient, kind: AgreementKind, bookingId: string): Promise<AgreementStatus> {
  if ((kind !== "rental" && kind !== "facility") || !(kind === "rental" ? rentalId(bookingId) : uuid(bookingId))) {
    throw new Error("Agreement status unavailable");
  }
  const canonicalId = kind === "facility" ? bookingId.toLowerCase() : bookingId;
  const { data, error } = await db.rpc("receptionist_agreement_status_snapshot", { p_kind: kind, p_booking_id: canonicalId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Agreement status unavailable");
  const snapshot = data as { booking?: unknown; agreements?: unknown };
  if (!("booking" in snapshot) || !Array.isArray(snapshot.agreements)) throw new Error("Agreement status unavailable");
  const booking = snapshot.booking;
  if (!booking) {
    if (snapshot.agreements.length !== 0) throw new Error("Agreement status unavailable");
    return { kind, state: "booking_not_found" };
  }
  const bookingRow = booking as unknown as { id: unknown; status: unknown; customer_name?: unknown };
  if (String(bookingRow.id) !== canonicalId || typeof bookingRow.status !== "string" || !bookingRow.status.trim()) throw new Error("Agreement status unavailable");
  const bookingStatus = bookingRow.status.trim().toLowerCase();
  if (["cancelled", "canceled", "rejected", "blocked"].includes(bookingStatus)) return { kind, state: "booking_closed" };
  if (!(kind === "rental" ? ["pending", "approved"] : ["pending", "confirmed"]).includes(bookingStatus)) throw new Error("Agreement status unavailable");

  const rows = snapshot.agreements;
  if (rows.length > 1) throw new Error("Agreement status unavailable");
  if (!rows.length) return { kind, state: "missing" };
  const row = rows[0] as unknown as { id: unknown; booking_id: unknown; version: unknown; status: unknown; signed_at: unknown; email_status: unknown; signer_legal_name?: unknown; reviewed_at?: unknown };
  if (!uuid(row.id) || String(row.booking_id) !== canonicalId || typeof row.version !== "number" || !Number.isSafeInteger(row.version) || row.version < 1 ||
      typeof row.email_status !== "string" || !["not_sent", "sent", "failed", "pending"].includes(row.email_status)) throw new Error("Agreement status unavailable");
  const awaiting = kind === "rental" ? "awaiting_signature" : "sent";
  if (row.status === "signed") {
    if (typeof row.signed_at !== "string" || !Number.isFinite(Date.parse(row.signed_at))) throw new Error("Agreement status unavailable");
    if (kind === "rental") {
      if (typeof bookingRow.customer_name !== "string" || (row.signer_legal_name !== null && typeof row.signer_legal_name !== "string") ||
          (row.reviewed_at !== null && (typeof row.reviewed_at !== "string" || !Number.isFinite(Date.parse(row.reviewed_at))))) throw new Error("Agreement status unavailable");
      if (!row.reviewed_at && !signerNameMatches(bookingRow.customer_name, row.signer_legal_name as string | null)) {
        return { kind, state: "signed_needs_review", agreementId: row.id, version: row.version, delivery: row.email_status as DeliveryState, freshness: "unverified" };
      }
    }
    return { kind, state: "signed", agreementId: row.id, version: row.version, delivery: row.email_status as DeliveryState, freshness: "unverified" };
  }
  if (row.status !== awaiting || row.signed_at !== null) throw new Error("Agreement status unavailable");
  return { kind, state: "awaiting_signature", agreementId: row.id, version: row.version, delivery: row.email_status as DeliveryState, freshness: "unverified" };
}
