import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../app/api/facility/invitations/[id]/guest-list/email/route.ts";
import { hasHostGuestListAccess } from "./host-guest-list.ts";

const bookingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const requestKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const wrongKey = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let requestNumber = 0;
function request(body: unknown) {
  return new Request(`https://jumpingjaxllc.com/api/facility/invitations/${bookingId}/guest-list/email`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-real-ip": `test-${++requestNumber}` }, body: JSON.stringify(body),
  });
}

test("host link email uses only the saved recipient, verifies booking access, and sends once", async context => {
  const envNames = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INVITATION_THEME_TOKEN_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "NEXT_PUBLIC_SITE_URL"];
  const oldEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://host-mail-test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key", INVITATION_THEME_TOKEN_SECRET: "test-host-secret", RESEND_API_KEY: "test-mail-key", RESEND_FROM_EMAIL: "Jumping Jax <host@example.com>", NEXT_PUBLIC_SITE_URL: "https://jumpingjaxllc.com" });
  let status = "confirmed";
  let outbox: Record<string, unknown> | undefined;
  const deliveries: Array<Record<string, unknown>> = [];
  const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
    const req = new Request(source, init);
    const url = new URL(req.url);
    assert.ok(["host-mail-test.supabase.co", "api.resend.com"].includes(url.hostname), "No live database or unrecognized service traffic");
    if (url.hostname === "api.resend.com") {
      assert.equal(req.method, "POST");
      assert.equal(url.pathname, "/emails");
      deliveries.push(await req.json());
      return json({ id: "fixture-email" });
    }
    if (url.pathname.endsWith("/facility_bookings")) {
      assert.equal(url.searchParams.get("id"), `eq.${bookingId}`);
      if (url.searchParams.get("idempotency_key") !== `eq.${requestKey}`) return json(null);
      return json({ id: bookingId, email: "saved-host@example.com", status, child_name: "Michael <Star>", readable_date: "2026-11-29", readable_time: "2:00 PM - 4:00 PM" });
    }
    assert.ok(url.pathname.endsWith("/booking_notification_outbox"));
    if (req.method === "POST") { outbox ??= { ...await req.json(), status: "pending", attempt_count: 0 }; return json([]); }
    if (req.method === "PATCH") { Object.assign(outbox!, await req.json()); return json([]); }
    return json(outbox);
  });
  try {
    const params = { params: Promise.resolve({ id: bookingId }) };
    const response = await POST(request({ requestKey }), params);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { sent: true });
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(deliveries.length, 1);
    const message = deliveries[0];
    assert.equal(message.to, "saved-host@example.com");
    const hostUrl = String(message.text).match(/https:\/\/\S+/)?.[0];
    assert.ok(hostUrl);
    const parsed = new URL(hostUrl);
    assert.equal(parsed.pathname, "/facility-parties/guest-list");
    assert.equal(parsed.searchParams.get("booking"), bookingId);
    assert.equal(hasHostGuestListAccess(bookingId, parsed.searchParams.get("token")!), true);
    assert.match(String(message.html), /Michael &lt;Star&gt;/);
    assert.equal((await POST(request({ requestKey }), params)).status, 200);
    assert.equal(deliveries.length, 1, "Repeat requests must not duplicate delivery");
    assert.equal((await POST(request({ requestKey: wrongKey }), params)).status, 404);
    assert.equal((await POST(request({ requestKey, to: "someone-else@example.com" }), params)).status, 400);
    status = "cancelled";
    assert.equal((await POST(request({ requestKey }), params)).status, 404);
    assert.equal(deliveries.length, 1);
  } finally {
    for (const name of envNames) { if (oldEnv[name] === undefined) delete process.env[name]; else process.env[name] = oldEnv[name]; }
  }
});
