import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDurableBookingEmail } from "./durable-email";

test("opt-in agreement email retries reject changed outbox payload before reporting success", async () => {
  const row = { status: "sent", booking_kind: "rental", booking_id: "123", purpose: "rental_agreement_signature",
    recipient: "caller@example.test", subject: "Sign agreement", body: "Fictional link", html_body: null };
  let stored = { ...row }, writes = 0;
  const supabase = { from(table: string) {
    assert.equal(table, "booking_notification_outbox");
    return {
      async upsert() { writes++; return { error: null }; },
      select() { return { eq() { return { async single() { return { data: stored, error: null }; } }; } }; },
    };
  } } as unknown as SupabaseClient;
  const input = { supabase, messageKey: "fictional-agreement-request", kind: "rental" as const, bookingId: "123",
    purpose: row.purpose, to: row.recipient, subject: row.subject, text: row.body, requireExactPayload: true };
  assert.equal((await sendDurableBookingEmail(input)).alreadySent, true);
  for (const changed of [{ recipient: "other@example.test" }, { booking_id: "124" }, { purpose: "other" },
    { subject: "Changed" }, { body: "Changed" }, { html_body: "Changed" }, { booking_kind: "facility" }]) {
    stored = { ...row, ...changed };
    assert.equal((await sendDurableBookingEmail(input)).error?.code, "outbox_payload_conflict");
  }
  stored = { ...row, status: "pending", recipient: "other@example.test" };
  assert.equal((await sendDurableBookingEmail(input)).error?.code, "outbox_payload_conflict");
  assert.equal(writes, 9);
});
