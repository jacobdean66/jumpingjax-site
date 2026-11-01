import assert from "node:assert/strict";
import test from "node:test";
import { gmailGet, gmailMail, isGmailId, isGmailPageToken, isKarenGmail, KAREN_GMAIL, openGmailToken, sealGmailToken, verifyKarenGmail } from "./gmail-core.ts";
import { buildGoogleAdsAuthorization, validateGoogleAdsState } from "../analytics/google-reporting-auth.ts";

const env = { GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-client-secret", ADMIN_SESSION_SECRET: "test-only-session-secret" };
test("Gmail consent requests read access and binds state to the owner", () => {
  const connection = buildGoogleAdsAuthorization(env, "https://example.invalid", "owner-1", "gmail")!;
  const url = new URL(connection.url);
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.readonly");
  assert.equal(url.searchParams.get("login_hint"), KAREN_GMAIL);
  assert.ok(validateGoogleAdsState(connection.cookie, url.searchParams.get("state"), "owner-1", env));
  assert.equal(validateGoogleAdsState(connection.cookie, url.searchParams.get("state"), "other-owner", env), null);
  assert.equal(validateGoogleAdsState(connection.cookie, "wrong-state", "owner-1", env), null);
  assert.equal(new URL(buildGoogleAdsAuthorization(env, "https://example.invalid", "owner-1")!.url).searchParams.get("scope"), "https://www.googleapis.com/auth/adwords");
});
test("Gmail tokens are authenticated and isolated from other connection keys", () => {
  const encrypted = sealGmailToken("test-only-refresh-token", env);
  assert.ok(!encrypted.includes("test-only-refresh-token"));
  assert.equal(openGmailToken(encrypted, env), "test-only-refresh-token");
  assert.equal(openGmailToken(encrypted, { ADMIN_SESSION_SECRET: "different-key" }), null);
  assert.equal(openGmailToken(encrypted.slice(0, -4) + "AAAA", env), null);
});
test("only Karen’s exact account can be connected", async () => {
  assert.ok(isKarenGmail(KAREN_GMAIL.toUpperCase()));
  assert.ok(!isKarenGmail("jacobdean1166@gmail.com"));
  const fetcher = (emailAddress: string) => (async () => Response.json({ emailAddress })) as typeof fetch;
  await verifyKarenGmail("fixture-token", fetcher(KAREN_GMAIL));
  await assert.rejects(verifyKarenGmail("fixture-token", fetcher("other@example.invalid")), /Choose Karen/);
});
test("nested MIME mail decodes unicode without treating attachments as message text", () => {
  const encode = (s: string) => Buffer.from(s).toString("base64url");
  const message = gmailMail({ id: "abc123", internalDate: "1700000000000", payload: { mimeType: "multipart/mixed", headers: [{ name: "SUBJECT", value: "Party 🎉" }], parts: [
    { mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: encode("Hello Karen 🎉") } }, { mimeType: "text/html", body: { data: encode("<p>Hello Karen</p>") } }] },
    { filename: "private.txt", mimeType: "text/plain", body: { data: encode("attachment contents") } },
  ] } });
  assert.equal(message.subject, "Party 🎉"); assert.equal(message.text, "Hello Karen 🎉"); assert.equal(message.html, "<p>Hello Karen</p>");
  assert.equal(message.date, "2023-11-14T22:13:20.000Z");
  assert.ok(isGmailId("abc123")); assert.ok(!isGmailId("../profile"));
  assert.ok(isGmailPageToken("12345")); assert.ok(!isGmailPageToken("bad&labelIds=TRASH"));
});
test("provider errors do not expose token or raw response details", async () => {
  await assert.rejects(gmailGet("secret-fixture", "profile", (async () => new Response("secret-fixture upstream details", { status: 403 })) as typeof fetch), error => {
    assert.ok(error instanceof Error); assert.ok(!error.message.includes("secret-fixture")); return true;
  });
});
