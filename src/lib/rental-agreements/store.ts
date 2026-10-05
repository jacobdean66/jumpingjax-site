import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadBookingPaymentMap } from "@/lib/payments/store";
import { projectBookingPaymentStatus } from "@/lib/payments/booking-payments";
import { buildRentalAgreementSnapshot } from "./snapshot";
import { agreementToken, hashToken } from "./security";
import type { RentalAgreement, RentalAgreementTemplate } from "./types";

export async function loadAgreementTemplate(): Promise<RentalAgreementTemplate> {
  const { data, error } = await createServiceRoleClient().from("rental_agreement_templates")
    .select("version,title,terms,updated_at,updated_by").order("version", { ascending: false }).limit(1).single();
  if (error || !data) throw new Error("The rental agreement could not be loaded. Please try again.");
  return data as RentalAgreementTemplate;
}
export function customerAgreementPath(id: string) { return `/rental-agreement/${agreementToken(id)}`; }

const SELECT = "id,booking_id,version,status,snapshot,created_at,signed_at,signer_legal_name,acknowledged,email_status,last_emailed_at,reviewed_by,reviewed_at,signature_method,paper_copy_path,paper_signed_on,paper_recorded_by,paper_recorded_at";
export async function loadAgreementHistory(ids: string[]) {
  const map = new Map<string, RentalAgreement[]>();
  if (!ids.length) return map;
  const { data, error } = await createServiceRoleClient().from("rental_agreements").select(SELECT)
    .in("booking_id", ids).order("version", { ascending: false });
  if (error) throw new Error("Agreement history is unavailable. Please retry before assuming this rental is unsigned.");
  for (const row of (data ?? []) as RentalAgreement[]) map.set(String(row.booking_id), [...(map.get(String(row.booking_id)) ?? []), row]);
  return map;
}
export async function loadAgreementByToken(token: string): Promise<RentalAgreement | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data, error } = await createServiceRoleClient().from("rental_agreements").select(SELECT)
    .eq("public_token_hash", hashToken(token)).maybeSingle();
  if (error) throw new Error("The agreement could not be loaded.");
  return data as RentalAgreement | null;
}
export async function loadAgreementById(bookingId: string, agreementId: string) {
  const { data, error } = await createServiceRoleClient().from("rental_agreements").select(SELECT)
    .eq("booking_id", bookingId).eq("id", agreementId).maybeSingle();
  if (error) throw new Error("The agreement could not be loaded.");
  return data as RentalAgreement | null;
}

export async function loadBookingAgreementContext(id: string) {
  const db = createServiceRoleClient();
  const [{ data: row, error }, { data: items, error: itemError }, template, ledger, history] = await Promise.all([
    db.from("bookings").select("*").eq("id", id).maybeSingle(),
    db.from("booking_rental_items").select("rental_item,rental_name").eq("booking_id", id).order("rental_item"),
    loadAgreementTemplate(), loadBookingPaymentMap("rental", [id]), loadAgreementHistory([id]),
  ]);
  if (error || itemError) throw new Error("The rental details could not be loaded.");
  if (!row) return null;
  const { data: state, error: stateError } = await db.rpc("rental_agreement_booking_state", { p_booking: row });
  if (stateError) throw new Error("The rental details could not be loaded.");
  const snapshot = buildRentalAgreementSnapshot({
    idempotencyKey: "admin-preview", customerName: row.customer_name, email: row.customer_email, phone: row.customer_phone,
    rental_items: items?.length ? items : [{ rental_item: row.rental_item, rental_name: row.rental_name }],
    eventDateYmd: String(row.event_date).slice(0,10), durationLabel: row.duration ?? "", foamDurationLabel: row.foam_duration,
    spanDays: row.span_days ?? 1, eventAddress: row.event_address ?? "", delivery_time: row.delivery_time,
    event_start_time: row.event_start_time, requested_delivery_window: row.requested_delivery_window,
    delivery_fee: Number(row.delivery_fee ?? 0), mileage_fee: Number(row.mileage_fee ?? 0),
    setup_location: row.setup_location ?? "", setup_surface: row.setup_surface ?? "", setup_access: row.setup_access ?? "", setup_notes: row.setup_notes ?? "",
    payment_method: row.payment_method ?? "", subtotal: Number(row.subtotal ?? 0), total: Number(row.total ?? 0),
  }, template);
  const payment = projectBookingPaymentStatus(row.total == null ? null : Number(row.total), ledger.get(id) ?? []);
  snapshot.paidTotal = payment.paidCents / 100;
  snapshot.balanceDue = payment.balanceCents == null ? 0 : payment.balanceCents / 100;
  snapshot.bookingState = state;
  if (row.total == null) snapshot.pricingLabel = "Quote is not set. Contact Jumping Jax for pricing before payment.";
  return { snapshot, history: history.get(id) ?? [], status: row.status, customerEmail: row.customer_email as string };
}
