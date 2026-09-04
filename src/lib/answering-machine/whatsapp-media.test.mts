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
});

test("rejects provider-controlled media URLs outside Meta and WhatsApp hosts", async () => {
  server.use(http.get("https://graph.facebook.com/v25.0/media-unsafe", () =>
    HttpResponse.json({ url: "https://attacker.example.test/audio" })));
  await assert.rejects(downloadWhatsAppMedia({
    mediaId: "media-unsafe", phoneNumberId: "phone-1", accessToken: "test-token", graphApiVersion: "v25.0",
  }), /unsafe media URL/i);
});
