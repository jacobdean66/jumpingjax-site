import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { downloadWhatsAppMedia } from "./whatsapp-media.ts";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());

test("downloads owner-requested voicemail through Meta's bounded two-step media flow", async () => {
  server.use(
    http.get("https://graph.facebook.com/v25.0/media-123", ({ request }) => {
      assert.equal(request.headers.get("authorization"), "Bearer test-token");
      return HttpResponse.json({ url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/test" });
    }),
    http.get("https://lookaside.fbsbx.com/whatsapp_business/attachments/test", ({ request }) => {
      assert.equal(request.headers.get("authorization"), "Bearer test-token");
      return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/ogg" } });
    }),
  );
  const result = await downloadWhatsAppMedia({
    mediaId: "media-123", phoneNumberId: "phone-1", accessToken: "test-token", graphApiVersion: "v25.0",
  });
  assert.equal(result.contentType, "audio/ogg");
  assert.equal((await new Response(result.body).arrayBuffer()).byteLength, 3);
});

test("redirects cannot bypass the media host boundary", async () => {
  server.use(
    http.get("https://graph.facebook.com/v25.0/media-redirect", () => HttpResponse.json({ url: "https://lookaside.fbsbx.com/redirect" })),
    http.get("https://lookaside.fbsbx.com/redirect", () => new HttpResponse(null, { status: 302, headers: { Location: "https://attacker.example.test/audio" } })),
  );
  await assert.rejects(downloadWhatsAppMedia({ mediaId: "media-redirect", phoneNumberId: "phone-1", accessToken: "test-token", graphApiVersion: "v25.0" }));
});

test("streaming size limit holds without Content-Length", async () => {
  server.use(
    http.get("https://graph.facebook.com/v25.0/media-large", () => HttpResponse.json({ url: "https://lookaside.fbsbx.com/large" })),
    http.get("https://lookaside.fbsbx.com/large", () => new HttpResponse(new Uint8Array(20 * 1024 * 1024 + 1), { headers: { "Content-Type": "audio/ogg" } })),
  );
  const result = await downloadWhatsAppMedia({ mediaId: "media-large", phoneNumberId: "phone-1", accessToken: "test-token", graphApiVersion: "v25.0" });
  await assert.rejects(new Response(result.body).arrayBuffer(), /safe limit/);
});

test("missing media type is rejected instead of being assumed to be audio", async () => {
  server.use(
    http.get("https://graph.facebook.com/v25.0/media-untyped", () => HttpResponse.json({ url: "https://lookaside.fbsbx.com/untyped" })),
    http.get("https://lookaside.fbsbx.com/untyped", () => new HttpResponse(new Uint8Array([1]))),
  );
  await assert.rejects(downloadWhatsAppMedia({ mediaId: "media-untyped", phoneNumberId: "phone-1", accessToken: "test-token", graphApiVersion: "v25.0" }), /invalid/);
});

test("rejects provider-controlled media URLs outside Meta and WhatsApp hosts", async () => {
  server.use(http.get("https://graph.facebook.com/v25.0/media-unsafe", () =>
    HttpResponse.json({ url: "https://attacker.example.test/audio" })));
  await assert.rejects(downloadWhatsAppMedia({
    mediaId: "media-unsafe", phoneNumberId: "phone-1", accessToken: "test-token", graphApiVersion: "v25.0",
  }), /unsafe media URL/i);
});
