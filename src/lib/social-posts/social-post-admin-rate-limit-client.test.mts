import assert from "node:assert/strict";
import test from "node:test";

import {
  createSocialPostRateLimitCooldown,
  formatSocialPostRateLimitPanelTitle,
  formatSocialPostRateLimitUserMessage,
  isSocialPostRateLimitCooldownActive,
  parseSocialPostApiFailure,
  parseSocialPostRateLimitFailure,
  socialPostRateLimitSecondsRemaining,
} from "./social-post-admin-rate-limit-client";

test("parser recognizes structured rate_limited 429 responses", () => {
  const body = {
    ok: false,
    error: "rate_limited",
    retryAfterSeconds: 45,
    diagnostics: {
      route: "/api/social-posts/[id]/generate-image",
      code: "rate_limited",
      category: "generation",
      message: "Too many generation requests. Try again in 45 seconds.",
    },
  };

  const parsed = parseSocialPostRateLimitFailure(429, body);
  assert.ok(parsed);
  assert.equal(parsed.kind, "rate_limited");
  assert.equal(parsed.category, "generation");
  assert.equal(parsed.retryAfterSeconds, 45);
  assert.match(parsed.message, /Too many requests/);
  assert.match(parsed.message, /45 seconds/);
});

test("localized retry guidance uses operation category label", () => {
  const message = formatSocialPostRateLimitUserMessage({
    category: "polling",
    retryAfterSeconds: 12,
  });

  assert.equal(formatSocialPostRateLimitPanelTitle(), "Too many requests");
  assert.match(message, /status polling/);
  assert.match(message, /12 seconds/);
});

test("non-rate-limit errors still parse normally", () => {
  const failure = parseSocialPostApiFailure(400, {
    ok: false,
    error: "Social post prompt is required for director preview.",
  });

  assert.ok(failure);
  assert.equal(failure.kind, "error");
  assert.match(failure.message, /prompt is required/);
});

test("successful responses do not produce failures", () => {
  assert.equal(parseSocialPostApiFailure(200, { ok: true, preview: {} }), null);
  assert.equal(parseSocialPostRateLimitFailure(200, { ok: false, error: "rate_limited" }), null);
});

test("cooldown helpers block only until retry window expires", () => {
  const now = 1_700_000_000_000;
  const cooldown = createSocialPostRateLimitCooldown("preview", 30, now);

  assert.equal(isSocialPostRateLimitCooldownActive(cooldown, now + 1_000), true);
  assert.equal(socialPostRateLimitSecondsRemaining(cooldown, now + 5_000), 25);
  assert.equal(isSocialPostRateLimitCooldownActive(cooldown, now + 30_000), false);
  assert.equal(socialPostRateLimitSecondsRemaining(cooldown, now + 30_000), 0);
});
