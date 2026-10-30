import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { belongsToOffice, emailDocument, listOfficeMessages, officeAttachment, readOfficeMessage, type OfficeMessage } from "./office-inbox";

const originalFetch = globalThis.fetch;
const originalKey = process.env.RESEND_API_KEY;
const originalInboxKey = process.env.RESEND_INBOX_API_KEY;
const originalOffice = process.env.INVOICE_OFFICE_EMAIL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
  if (originalInboxKey === undefined) delete process.env.RESEND_INBOX_API_KEY; else process.env.RESEND_INBOX_API_KEY = originalInboxKey;
  if (originalOffice === undefined) delete process.env.INVOICE_OFFICE_EMAIL; else process.env.INVOICE_OFFICE_EMAIL = originalOffice;
});
const id = "00000000-0000-4000-8000-000000000001";
const attachmentId = "00000000-0000-4000-8000-000000000002";
const message: OfficeMessage = { id, from: "Customer <customer@example.com>", to: ["info@jumpingjaxllc.com"], subject: "Invoice question", created_at: "2026-10-30T13:15:00Z" };

test("office scoping handles direct, CC, BCC and forwarded envelopes without exposing other mail", () => {
  delete process.env.INVOICE_OFFICE_EMAIL;
  assert.equal(belongsToOffice(message, "inbox"), true);
  for (const key of ["to", "cc", "bcc", "received_for"] as const) {
    assert.equal(belongsToOffice({ ...message, to: ["other@example.com"], [key]: ["Office <INFO@JUMPINGJAXLLC.COM>"] }, "inbox"), true);
  }
  assert.equal(belongsToOffice({ ...message, to: ["other@example.com"] }, "inbox"), false);
  assert.equal(belongsToOffice({ ...message, to: ["info@jumpingjaxllc.com.evil.test"] }, "inbox"), false);
});

test("sent folder includes every email copied or sent to this office", () => {
  delete process.env.INVOICE_OFFICE_EMAIL;
  assert.equal(belongsToOffice(message, "sent"), true);
  assert.equal(belongsToOffice({ ...message, subject: "Jumping Jax invoice JJ-R-605" }, "sent"), true);
  assert.equal(belongsToOffice({ ...message, subject: "Office copy — Jumping Jax invoice JJ-R-605" }, "sent"), true);
  assert.equal(belongsToOffice({ ...message, to: ["customer@example.com"], subject: "Jumping Jax invoice JJ-R-605" }, "sent"), false);
});

test("reading an unrelated or malformed message cannot reveal its content", async () => {
  delete process.env.INVOICE_OFFICE_EMAIL;
  process.env.RESEND_API_KEY = "test-credential";
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json({ ...message, to: ["other@example.com"], html: "Private unrelated email" }); }) as typeof fetch;
  assert.equal(await readOfficeMessage("inbox", "../../domains"), null);
  assert.equal(calls, 0);
  assert.equal(await readOfficeMessage("inbox", id), null);
  assert.equal(calls, 1);
});

test("BCC envelope hydration preserves office copies and the upstream pagination cursor", async () => {
  delete process.env.INVOICE_OFFICE_EMAIL;
  process.env.RESEND_API_KEY = "test-credential";
  const paths: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input); paths.push(url);
    assert.equal(init?.cache, "no-store");
    return Response.json(url.includes("?limit=") ? { data: [{ ...message, to: ["customer@example.com"] }], has_more: true } : { ...message, to: ["customer@example.com"], received_for: ["info@jumpingjaxllc.com"], html: "Office copy" });
  }) as typeof fetch;
  const page = await listOfficeMessages("inbox", id);
  assert.equal(page.messages.length, 1);
  assert.equal(page.next, id);
  assert.ok(paths[0].includes("after=" + id));
  assert.equal(paths[1], "https://api.resend.com/emails/receiving/" + id);
});

test("upstream errors remain errors, without exposing response bodies or credentials", async () => {
  process.env.RESEND_API_KEY = "test-credential";
  globalThis.fetch = (async () => new Response("private provider diagnostic and credential", { status: 403 })) as typeof fetch;
  await assert.rejects(listOfficeMessages("sent"), error => error instanceof Error && error.message === "Email service access was denied. Please contact the site administrator.");
});

test("inbox requests use their dedicated credential when configured", async () => {
  process.env.RESEND_API_KEY = "send-only-placeholder";
  process.env.RESEND_INBOX_API_KEY = "inbox-placeholder";
  globalThis.fetch = (async (_input, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer inbox-placeholder");
    return Response.json({ data: [], has_more: false });
  }) as typeof fetch;
  assert.deepEqual(await listOfficeMessages("inbox"), { messages: [], next: null });
});

test("sent office copies are collected across unrelated provider pages", async () => {
  delete process.env.INVOICE_OFFICE_EMAIL;
  process.env.RESEND_API_KEY = "test-credential";
  let calls = 0;
  globalThis.fetch = (async (input) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("limit"), "100");
    if (calls === 1) return Response.json({ data: [{ ...message, to: ["someone@example.com"] }], has_more: true });
    assert.equal(url.searchParams.get("after"), id);
    return Response.json({ data: [{ ...message, subject: "Office copy from a later page" }], has_more: false });
  }) as typeof fetch;
  const result = await listOfficeMessages("sent");
  assert.equal(calls, 2);
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].subject, "Office copy from a later page");
  assert.equal(result.next, null);
});

test("attachments require membership in the office message", async () => {
  delete process.env.INVOICE_OFFICE_EMAIL;
  process.env.RESEND_API_KEY = "test-credential";
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json({ ...message, attachments: [] }); }) as typeof fetch;
  assert.equal(await officeAttachment(id, attachmentId), null);
  assert.equal(calls, 1);
});

test("HTML email is contained by a document policy that blocks scripts and remote resources", () => {
  const document = emailDocument('<script>parent.document.cookie</script><img src="https://tracker.example.com/pixel">');
  assert.ok(document.indexOf('http-equiv="Content-Security-Policy"') < document.indexOf("<script>"));
  assert.ok(document.includes("default-src 'none'"));
  assert.ok(document.includes("script-src 'none'"));
  assert.ok(document.includes("img-src data:"));
  assert.ok(document.includes("form-action 'none'"));
});
