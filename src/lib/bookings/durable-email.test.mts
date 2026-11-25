import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { sendDurableBookingEmail } from "./durable-email.ts";

for (const scenario of ["invalid address", "authentication", "quota", "rate limit", "outage", "status write"] as const) {
  test(`durable email handles ${scenario} without duplicates or a false success`, async context => {
    const previous = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "test-key";
    let row: Record<string, unknown> | undefined;
    let attempts = 0;
    const bodies: unknown[] = [];
    context.mock.method(console, "error", () => {});
    context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
      const req = new Request(source, init);
      const url = new URL(req.url);
      if (url.hostname === "api.resend.com") {
        attempts++;
        assert.equal(req.headers.get("idempotency-key"), "rental-test-customer-receipt-v1");
        bodies.push(await req.json());
        if (scenario === "authentication") return Response.json({ name: "invalid_api_key", message: "secret details must not be stored" }, { status: 401 });
        if (scenario === "quota") return Response.json({ name: "daily_quota_exceeded", message: "Limit reached" }, { status: 429 });
        if (scenario === "rate limit" && attempts === 1) return Response.json({ name: "rate_limit_exceeded", message: "Slow down" }, { status: 429, headers: { "retry-after": "1" } });
        if (scenario === "outage") return Response.json({ name: "internal_server_error", message: "Temporary failure" }, { status: 500 });
        return Response.json({ id: "test-id" });
      }
      assert.equal(url.hostname, "durable-test.supabase.co", "No live traffic");
      assert.equal(url.pathname, "/rest/v1/booking_notification_outbox");
      if (req.method === "POST") { row ??= { ...await req.json(), status: "pending", attempt_count: 0 }; return new Response(null, { status: 201 }); }
      if (req.method === "PATCH") {
        if (scenario === "status write") return Response.json({ code: "TEST", message: "Write unavailable" }, { status: 503 });
        Object.assign(row!, await req.json()); return new Response(null, { status: 204 });
      }
      return Response.json(row);
    });
    try {
      const input = { supabase: createClient("https://durable-test.supabase.co", "test-key", { auth: { persistSession: false } }), messageKey: "rental-test-customer-receipt-v1", kind: "rental" as const, bookingId: "test", purpose: "initial_customer_receipt", to: scenario === "invalid address" ? "coscram,2018@gmail.com" : "test@example.invalid", subject: "Booking received", text: "Saved request" };
      const result = await sendDurableBookingEmail(input);
      if (scenario === "rate limit") {
        assert.equal(result.error, null); assert.equal(attempts, 2);
        assert.equal((await sendDurableBookingEmail(input)).alreadySent, true);
        assert.equal(attempts, 2);
      } else {
        assert.equal(result.error?.code, { "invalid address": "customer_email_invalid", authentication: "email_authentication_failed", quota: "email_quota_exceeded", outage: "email_provider_unavailable", "status write": "email_status_write_failed" }[scenario]);
        assert.equal(attempts, scenario === "invalid address" ? 0 : scenario === "outage" ? 3 : 1);
      }
      if (bodies.length > 1) for (const body of bodies) assert.deepEqual(body, bodies[0]);
      assert.doesNotMatch(String(row!.last_error_class), /secret details/);
    } finally {
      if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous;
    }
  });
}

test("single-attempt agreement mail records provider ambiguity without retrying", async context => {
  const previous = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "test-key";
  let row: Record<string, unknown> | undefined;
  let attempts = 0;
  context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
    const req = new Request(source, init);
    const url = new URL(req.url);
    if (url.hostname === "api.resend.com") {
      attempts++;
      return Response.json({ name: "internal_server_error", message: "ambiguous" }, { status: 500 });
    }
    if (req.method === "POST") { row = { ...await req.json(), status: "pending", attempt_count: 0 }; return new Response(null, { status: 201 }); }
    if (req.method === "PATCH") { Object.assign(row!, await req.json()); return new Response(null, { status: 204 }); }
    return Response.json(row);
  });
  try {
    const supabase = createClient("https://durable-test.supabase.co", "test-key");
    const result = await sendDurableBookingEmail({
      supabase, messageKey: "receptionist-agreement-2ecf032f-f261-44fb-a0e0-fc180e456789",
      kind: "rental", bookingId: "123", purpose: "rental_agreement_signature", to: "caller@example.test",
      subject: "Sign rental", text: "Exact message", requireExactPayload: true, singleAttempt: true,
      payloadMac: "a".repeat(64), tags: [{ name: "agreement_operation_id", value: "2ecf032f-f261-44fb-a0e0-fc180e456789" }],
    });
    assert.deepEqual(result, { error: { code: "email_provider_unavailable" }, outcomeUnknown: true });
    assert.equal(attempts, 1);
    assert.equal(row?.status, "pending");
    assert.equal(row?.attempt_count, 1);
    assert.equal(row?.payload_mac, "a".repeat(64));
  } finally {
    if (previous === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous;
  }
});
