import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { configureMetaScheduledPublicationTestDependencies, type MetaScheduledPublicationDependencies } from "../../../../lib/social-posts/oauth/social-meta-scheduled-publication-service";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "route.ts"), "utf8");

test("scheduled Social Posts worker requires CRON_SECRET and the protected runner", () => {
  assert.match(source, /CRON_SECRET/);
  assert.match(source, /Bearer/);
  assert.match(source, /runDueMetaOrganicPublications/);
  assert.doesNotMatch(source, /verifyAdminAccess|verifyAdminOwnerAccess/);
});

test("cron returns sanitized 503 for missing scheduler schema and never publishes", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "fixture-cron-key";
  let claims = 0;
  let publishes = 0;
  configureMetaScheduledPublicationTestDependencies({
    store: { claimDue: async () => { claims += 1; throw { code: "PGRST202", message: "secret=fixture" }; } },
    publish: async () => { publishes += 1; throw new Error("Must not publish"); },
  } as unknown as MetaScheduledPublicationDependencies);
  try {
    const denied = await GET(new NextRequest("https://example.test/api/cron/social-posts"));
    assert.equal(denied.status, 401);
    assert.equal(claims, 0);
    const result = await GET(new NextRequest("https://example.test/api/cron/social-posts", { headers: { authorization: "Bearer fixture-cron-key" } }));
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    const body = await result.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "scheduler_schema_unavailable");
    assert.match(body.message, /20260925130000/);
    assert.doesNotMatch(JSON.stringify(body), /secret=fixture/);
    assert.equal(publishes, 0);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
    configureMetaScheduledPublicationTestDependencies(null);
  }
});
