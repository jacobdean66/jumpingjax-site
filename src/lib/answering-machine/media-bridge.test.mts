import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { forwardWhatsAppCallToMediaBridge } from "./media-bridge.ts";

const bridgeUrl = "https://bridge.example.test/whatsapp/calls";
const server = setupServer();

before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());

test("forwards a signed, bounded provider event without live network access", async () => {
  const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  let receivedAuthorization = "";
  let receivedBody = "";
  server.use(http.post(bridgeUrl, async ({ request }) => {
    receivedAuthorization = request.headers.get("authorization") ?? "";
    receivedBody = await request.text();
    return HttpResponse.json({ ok: true });
  }));

  await forwardWhatsAppCallToMediaBridge({
    bridgeUrl,
    bridgeSecret: "test-only-secret",
    rawBody,
  });

  assert.equal(receivedAuthorization, "Bearer test-only-secret");
  assert.equal(receivedBody, rawBody);
});

test("fails closed when the provider bridge rejects the event", async () => {
  server.use(http.post(bridgeUrl, () => new HttpResponse(null, { status: 503 })));

  await assert.rejects(
    forwardWhatsAppCallToMediaBridge({
      bridgeUrl,
      bridgeSecret: "test-only-secret",
      rawBody: "{}",
    }),
    /rejected call event/i,
  );
});
