import assert from "node:assert/strict";
import test from "node:test";

import { getApplicationSecurityChecks } from "./application-security.ts";

const MANAGED_KEYS = [
  "ADMIN_SESSION_SECRET",
  "ADMIN_OWNER_PASSWORD",
  "ADMIN_DELIVERIES_TOKEN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_PRIVATE_API_KEY",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_REF",
] as const;

function withEnv(
  values: Partial<Record<(typeof MANAGED_KEYS)[number], string>>,
  run: () => void,
) {
  const before = Object.fromEntries(MANAGED_KEYS.map((key) => [key, process.env[key]]));
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    for (const key of MANAGED_KEYS) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("application checks verify a fully isolated production configuration", () => {
  withEnv({
    ADMIN_SESSION_SECRET: "dedicated-session-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_GIT_COMMIT_REF: "main",
  }, () => {
    const checks = getApplicationSecurityChecks({
      now: new Date("2026-09-25T12:00:00.000Z"),
      securityStoreReachable: true,
    });
    assert.equal(checks.every((item) => item.state === "healthy"), true);
    assert.match(checks[0].summary, /main@aaaaaaa/);
  });
});

test("application checks flag fallback signing, missing store, and public secret names", () => {
  withEnv({
    ADMIN_OWNER_PASSWORD: "fallback-password",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    NEXT_PUBLIC_PRIVATE_API_KEY: "must-not-be-public",
  }, () => {
    const checks = getApplicationSecurityChecks({ securityStoreReachable: false });
    assert.equal(checks.find((item) => item.id === "admin-session")?.state, "degraded");
    assert.equal(checks.find((item) => item.id === "security-store")?.state, "unavailable");
    assert.equal(checks.find((item) => item.id === "public-secret-exposure")?.state, "failing");
  });
});
