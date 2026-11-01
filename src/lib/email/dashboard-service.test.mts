import assert from "node:assert/strict";
import test from "node:test";
import { loadEmailDetail, loadEmailPage } from "./dashboard-service.ts";

test("mail remains readable and categorized during a workflow storage outage, without a false saved status", async () => {
  const oldFetch = globalThis.fetch;
  const keys = ["RESEND_API_KEY", "RESEND_INBOX_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INVOICE_OFFICE_EMAIL"] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.RESEND_API_KEY = "test-only-mail-key";
  delete process.env.RESEND_INBOX_API_KEY;
  delete process.env.INVOICE_OFFICE_EMAIL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture-storage.example.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-storage-key";
  const message = { id: "11111111-2222-4333-8444-555555555555", from: "customer@example.invalid", to: ["info@jumpingjaxllc.com"], subject: "New facility booking request", created_at: "2026-11-01T15:00:00Z", text: "Fictional booking question", html: "<p>Fictional booking question</p>" };
  globalThis.fetch = (async input => {
    const url = new URL(String(input));
    if (url.hostname === "api.resend.com") return Response.json(url.search ? { data: [message], has_more: false } : message);
    return new Response(JSON.stringify({ message: "fixture storage unavailable" }), { status: 503 });
  }) as typeof fetch;
  try {
    const page = await loadEmailPage("office", "inbox", "");
    assert.equal(page.messages.length, 1); assert.equal(page.messages[0].category, "parties");
    assert.equal(page.messages[0].status, "none"); assert.match(page.warning, /could not be loaded/);
    const detail = await loadEmailDetail("office", "inbox", message.id);
    assert.equal(detail?.text, message.text); assert.match(detail?.workflowWarning || "", /unavailable/);
    assert.match(detail?.document || "", /script-src 'none'/);
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
