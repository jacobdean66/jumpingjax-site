import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSocialPostAdminRateLimitClientKey,
  checkSocialPostAdminRateLimit,
  resetSocialPostAdminRateLimitBucketsForTests,
  SOCIAL_POST_ADMIN_RATE_LIMITS,
} from "./social-post-admin-rate-limit-core";
import { socialPostAdminRateLimitResponse } from "./social-post-admin-rate-limit";

function responseBody(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

test("rate limit allows requests up to category limit", () => {
  resetSocialPostAdminRateLimitBucketsForTests();
  const now = 1_700_000_000_000;
  const limits = {
    generation: { limit: 2, windowMs: 60_000 },
    polling: { limit: 2, windowMs: 60_000 },
    preview: { limit: 2, windowMs: 60_000 },
    verification: { limit: 2, windowMs: 60_000 },
    draft: { limit: 2, windowMs: 60_000 },
  };

  const first = checkSocialPostAdminRateLimit({
    clientKey: "token:test",
    category: "generation",
    now,
    limits,
  });
  const second = checkSocialPostAdminRateLimit({
    clientKey: "token:test",
    category: "generation",
    now: now + 1,
    limits,
  });
  const third = checkSocialPostAdminRateLimit({
    clientKey: "token:test",
    category: "generation",
    now: now + 2,
    limits,
  });

  assert.equal(first.limited, false);
  assert.equal(second.limited, false);
  assert.equal(third.limited, true);
  if (third.limited) {
    assert.equal(third.category, "generation");
    assert.ok(third.retryAfterSeconds >= 1);
  }
});

test("rate limit buckets are isolated per category and client", () => {
  resetSocialPostAdminRateLimitBucketsForTests();
  const now = 1_700_000_000_000;
  const limits = {
    generation: { limit: 1, windowMs: 60_000 },
    polling: { limit: 1, windowMs: 60_000 },
    preview: { limit: 1, windowMs: 60_000 },
    verification: { limit: 1, windowMs: 60_000 },
    draft: { limit: 1, windowMs: 60_000 },
  };

  const generation = checkSocialPostAdminRateLimit({
    clientKey: "token:a",
    category: "generation",
    now,
    limits,
  });
  const polling = checkSocialPostAdminRateLimit({
    clientKey: "token:a",
    category: "polling",
    now,
    limits,
  });
  const otherClient = checkSocialPostAdminRateLimit({
    clientKey: "token:b",
    category: "generation",
    now,
    limits,
  });

  assert.equal(generation.limited, false);
  assert.equal(polling.limited, false);
  assert.equal(otherClient.limited, false);
});

test("rate limit response uses structured 429 contract", async () => {
  resetSocialPostAdminRateLimitBucketsForTests();
  const request = new Request("https://example.com/api/social-posts/test", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  const route = "/api/social-posts/[id]/generate-image";
  const input = {
    route,
    category: "generation" as const,
    token: "admin-token",
  };

  for (let attempt = 0; attempt < SOCIAL_POST_ADMIN_RATE_LIMITS.generation.limit; attempt += 1) {
    assert.equal(socialPostAdminRateLimitResponse(request, input), null);
  }

  const blocked = socialPostAdminRateLimitResponse(request, input);
  assert.ok(blocked);
  const body = await responseBody(blocked);
  assert.equal(blocked.status, 429);
  assert.equal(body.ok, false);
  assert.equal(body.error, "rate_limited");
  assert.ok(Number(body.retryAfterSeconds) >= 1);
  assert.equal((body.diagnostics as { code: string }).code, "rate_limited");
  assert.equal((body.diagnostics as { category: string }).category, "generation");
  assert.equal((body.diagnostics as { route: string }).route, route);
  assert.equal(blocked.headers.get("Retry-After"), String(body.retryAfterSeconds));
  assert.equal(body.stack, undefined);
});

test("client key prefers admin token over forwarded IP", () => {
  const request = new Request("https://example.com", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });

  assert.equal(
    buildSocialPostAdminRateLimitClientKey(request, "secret-admin-token"),
    "token:secret-admin-token",
  );
  assert.equal(
    buildSocialPostAdminRateLimitClientKey(request, null),
    "ip:203.0.113.10",
  );
});

test("admin rate limits leave room for normal polling and manual generation", () => {
  assert.ok(SOCIAL_POST_ADMIN_RATE_LIMITS.polling.limit >= 60);
  assert.ok(SOCIAL_POST_ADMIN_RATE_LIMITS.generation.limit >= 5);
  assert.ok(SOCIAL_POST_ADMIN_RATE_LIMITS.preview.limit >= 20);
  assert.ok(SOCIAL_POST_ADMIN_RATE_LIMITS.verification.limit >= 30);
});

resetSocialPostAdminRateLimitBucketsForTests();
