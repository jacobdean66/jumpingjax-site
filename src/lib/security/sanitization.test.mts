import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeAikidoDetailsUrl, sanitizeSecurityMessage } from "./sanitization.ts";

test("security message sanitizer redacts common secret shapes", () => {
  const message = sanitizeSecurityMessage(
    "Scan failed: Authorization: Bearer abc.def token=live-token api_key=jj-secret sk-proj_abcdefghijklmnop https://example.com/path?token=raw&ok=1",
  );

  assert.match(message, /Authorization:\[redacted\]/);
  assert.match(message, /token=\[redacted\]/);
  assert.match(message, /api_key=\[redacted\]/);
  assert.doesNotMatch(message, /live-token|jj-secret|sk-proj_abcdefghijklmnop|raw/);
  assert.match(message, /ok=1/);
});

test("security message sanitizer normalizes controls and length", () => {
  const message = sanitizeSecurityMessage(`Aikido\u0000result\n${"x".repeat(400)}`);

  assert.equal(message.includes("\u0000"), false);
  assert.equal(message.includes("\n"), false);
  assert.equal(message.length, 240);
});

test("Aikido details URLs are allowlisted and stripped to path", () => {
  assert.equal(
    sanitizeAikidoDetailsUrl("https://app.aikido.dev/featurebranch/scan/17?token=secret#finding"),
    "https://app.aikido.dev/featurebranch/scan/17",
  );
  assert.equal(sanitizeAikidoDetailsUrl("https://app.aikido.dev/repositories/2828507?token=secret"), null);
  assert.equal(sanitizeAikidoDetailsUrl("https://evil.example/featurebranch/scan/17"), null);
  assert.equal(sanitizeAikidoDetailsUrl("javascript:alert(1)"), null);
});
