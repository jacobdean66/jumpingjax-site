import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { recordEmailRetryOutcome } from "./email-retry-outcome.ts";

test("retries reconcile the relevant workflow and keep incomplete owner deliveries flagged", async context => {
  const outcomes: Record<string, unknown>[] = [];
  let ownerStatuses = [{ status: "sent" }, { status: "failed" }];
  context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
    const req = new Request(source, init);
    const url = new URL(req.url);
    assert.equal(url.hostname, "retry-test.supabase.co", "No live traffic");
    if (url.pathname.endsWith("booking_notification_outbox")) return Response.json(ownerStatuses);
    assert.equal(url.pathname, "/rest/v1/rpc/record_booking_workflow_outcome");
    outcomes.push(await req.json()); return new Response(null, { status: 204 });
  });
  const base = { supabase: createClient("https://retry-test.supabase.co", "test-only-key", { auth: { persistSession: false } }), kind: "facility" as const, bookingId: "test" };
  await recordEmailRetryOutcome({ ...base, purpose: "decision_confirm" });
  await recordEmailRetryOutcome({ ...base, purpose: "owner_notification" });
  ownerStatuses = [{ status: "sent" }, { status: "sent" }];
  await recordEmailRetryOutcome({ ...base, purpose: "owner_notification" });
  await recordEmailRetryOutcome({ ...base, purpose: "initial_customer_receipt", errorCode: "customer_email_invalid" });
  await recordEmailRetryOutcome({ ...base, purpose: "payment_receipt" });
  assert.deepEqual(outcomes.map(x => [x.p_step, x.p_outcome, x.p_error_class]), [["decision_email", "sent", null], ["owner_notification", "failed", "owner_notification_failed"], ["owner_notification", "sent", null], ["initial_customer_email", "failed", "customer_email_invalid"]]);
});
