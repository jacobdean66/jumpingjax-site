import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../../app/api/facility/invitations/[id]/email/route.ts";

const bookingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const requestKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("post-booking invitation email authorizes the booking browser, fixes the recipient, and deduplicates retries", async context => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "VERCEL_ENV", "VERCEL_BRANCH_URL"] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://delivery-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  process.env.RESEND_API_KEY = "re_test_only";
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_BRANCH_URL = "invitation-delivery-test.vercel.app";
  context.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } });
  let status: string | null = "pending";
  let failEmail = false;
  let sent = 0;
  let calls = 0;
  let stored: Record<string, unknown> | null = null;
  const recipient = "booking-customer@example.com";
  context.mock.method(globalThis, "fetch", async (source: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    const url = new URL(source instanceof Request ? source.url : source.toString());
    const method = init?.method || "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (url.hostname === "api.resend.com") {
      assert.equal(url.pathname, "/emails");
      assert.equal(body.to, recipient);
      assert.match(body.text, new RegExp(`/facility-parties/invitations/${bookingId}`));
      assert.ok(body.text.includes(`https://invitation-delivery-test.vercel.app/facility-parties/invitations/${bookingId}`));
      assert.ok(!body.text.includes(requestKey));
      sent += 1;
      return Response.json(failEmail ? { name: "validation_error", message: "Test failure" } : { id: "test-email" }, { status: failEmail ? 422 : 200 });
    }
    assert.equal(url.hostname, "delivery-test.supabase.co");
    if (url.pathname.endsWith("/facility_bookings")) {
      assert.equal(url.searchParams.get("id"), `eq.${bookingId}`);
      return Response.json(url.searchParams.get("idempotency_key") === `eq.${requestKey}` ? { id: bookingId, email: recipient, status, invitation: { version: 1 } } : null);
    }
    assert.ok(url.pathname.endsWith("/booking_notification_outbox"));
    if (method === "POST") { stored ??= { ...body, status: "pending", attempt_count: 0 }; return new Response(null, { status: 201 }); }
    if (method === "PATCH") { Object.assign(stored!, body); return new Response(null, { status: 204 }); }
    return Response.json(stored);
  });
  let sequence = 0;
  const submit = (body: unknown) => POST(new Request("https://site.example/api/email", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `delivery-test-${sequence++}` }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: bookingId }) });

  assert.equal((await submit({ requestKey, to: "attacker@example.com" })).status, 400);
  assert.equal(calls, 0);
  assert.equal((await submit({ requestKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" })).status, 404);
  assert.equal(sent, 0);
  for (const inactive of ["cancelled", "canceled", " CANCELED ", "rejected", "denied", "unknown", null]) {
    status = inactive;
    assert.equal((await submit({ requestKey })).status, 404);
    assert.equal(sent, 0, "inactive parties must not send invitation email");
    assert.equal(stored, null, "inactive parties must not queue durable email");
  }
  status = "pending";
  assert.equal((await submit({ requestKey })).status, 200);
  assert.equal(sent, 1);
  assert.equal((await submit({ requestKey })).status, 200);
  assert.equal(sent, 1, "repeat clicks must not send duplicate email");
  stored = null;
  failEmail = true;
  assert.equal((await submit({ requestKey })).status, 503);
  failEmail = false;
  assert.equal((await submit({ requestKey })).status, 200, "a failed email can be retried without rebooking");
  for (const active of ["approved", "confirmed", " PENDING "]) {
    status = active;
    stored = null;
    assert.equal((await submit({ requestKey })).status, 200);
  }
});
