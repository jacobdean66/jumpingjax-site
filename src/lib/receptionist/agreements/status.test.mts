import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCurrentAgreementStatus } from "./status";

const agreementId = "1ecf032f-f261-44fb-a0e0-fc180e456789";
const facilityId = "2ecf032f-f261-44fb-a0e0-fc180e456789";
const rental = { id: agreementId, booking_id: 123, version: 2, status: "signed", signed_at: "2026-11-04T20:00:00Z", email_status: "sent", signer_legal_name: "Alex Example", reviewed_at: null };

function fixture({ booking = { id: 123, status: "pending", customer_name: "Alex Example" }, rows = [rental], error = false }: {
  booking?: unknown; rows?: unknown[]; error?: boolean;
} = {}) {
  const calls: unknown[][] = [];
  const db = {
    async rpc(name: string, args: unknown) { calls.push(["rpc", name, args]); return { data: { booking, agreements: booking === null ? [] : rows }, error: error ? { message: "synthetic" } : null }; },
  } as unknown as SupabaseClient;
  return { db, calls };
}

test("reports only the current agreement and keeps signature separate from email status", async () => {
  const signed = fixture();
  assert.deepEqual(await loadCurrentAgreementStatus(signed.db, "rental", "123"),
    { kind: "rental", state: "signed", agreementId, version: 2, delivery: "sent", freshness: "unverified" });
  assert.deepEqual(signed.calls, [["rpc", "receptionist_agreement_status_snapshot", { p_kind: "rental", p_booking_id: "123" }]]);
  const awaiting = fixture({ rows: [{ ...rental, status: "awaiting_signature", signed_at: null, email_status: "sent" }] });
  assert.equal((await loadCurrentAgreementStatus(awaiting.db, "rental", "123")).state, "awaiting_signature");
  const review = fixture({ rows: [{ ...rental, signer_legal_name: "Different Name" }] });
  assert.equal((await loadCurrentAgreementStatus(review.db, "rental", "123")).state, "signed_needs_review");
  const facility = fixture({ booking: { id: facilityId, status: "pending" }, rows: [{ id: agreementId, booking_id: facilityId, version: 1, status: "signed", signed_at: "2026-11-04T20:00:00Z", email_status: "failed" }] });
  assert.deepEqual(await loadCurrentAgreementStatus(facility.db, "facility", facilityId),
    { kind: "facility", state: "signed", agreementId, version: 1, delivery: "failed", freshness: "unverified" });
  assert.equal((await loadCurrentAgreementStatus(facility.db, "facility", facilityId.toUpperCase())).state, "signed");
});

test("fails closed on lookup errors, inconsistent records or multiple current versions", async () => {
  assert.equal((await loadCurrentAgreementStatus(fixture({ booking: null }).db, "rental", "123")).state, "booking_not_found");
  assert.equal((await loadCurrentAgreementStatus(fixture({ booking: { id: 123, status: "cancelled", customer_name: "Alex Example" } }).db, "rental", "123")).state, "booking_closed");
  assert.equal((await loadCurrentAgreementStatus(fixture({ booking: { id: 123, status: " CANCELLED ", customer_name: "Alex Example" } }).db, "rental", "123")).state, "booking_closed");
  await assert.rejects(loadCurrentAgreementStatus(fixture({ booking: { id: 123, status: "mystery", customer_name: "Alex Example" } }).db, "rental", "123"), /unavailable/);
  assert.equal((await loadCurrentAgreementStatus(fixture({ rows: [] }).db, "rental", "123")).state, "missing");
  for (const db of [fixture({ error: true }).db, fixture({ rows: [rental, { ...rental, version: 1 }] }).db,
    fixture({ rows: [{ ...rental, signed_at: null }] }).db, fixture({ rows: [{ ...rental, booking_id: 124 }] }).db]) {
    await assert.rejects(loadCurrentAgreementStatus(db, "rental", "123"), /unavailable/);
  }
  await assert.rejects(loadCurrentAgreementStatus(fixture().db, "rental", "01"), /unavailable/);
  await assert.rejects(loadCurrentAgreementStatus(fixture().db, "facility", "123"), /unavailable/);
});
