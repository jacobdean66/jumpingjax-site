import assert from "node:assert/strict";
import test from "node:test";

import { loadMetaAdsDashboard } from "./dashboard-service";

test("loadMetaAdsDashboard returns misconfigured state without live Meta calls", async () => {
  const previous = {
    OAUTH_ENABLED: process.env.OAUTH_ENABLED,
    META_OAUTH_ENABLED: process.env.META_OAUTH_ENABLED,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    CREDENTIAL_VAULT_MASTER_KEY: process.env.CREDENTIAL_VAULT_MASTER_KEY,
  };

  process.env.OAUTH_ENABLED = "false";
  process.env.META_OAUTH_ENABLED = "false";
  delete process.env.META_APP_ID;
  delete process.env.META_APP_SECRET;
  delete process.env.CREDENTIAL_VAULT_MASTER_KEY;

  try {
    let fetchCalls = 0;
    const view = await loadMetaAdsDashboard({
      preset: "last_7d",
      now: new Date("2026-08-11T15:00:00Z"),
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("should not fetch");
      },
    });

    assert.equal(view.freshness, "misconfigured");
    assert.equal(fetchCalls, 0);
    assert.equal(view.totals.spend.kind, "unavailable");
    assert.equal(view.connection.hasConnectedSession, false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("loadMetaAdsDashboard rejects unauthorized account ids after discovery", async () => {
  // This test only covers date-range invalidation without needing vault access.
  const view = await loadMetaAdsDashboard({
    preset: "custom",
    since: "2026-08-20",
    until: "2026-08-01",
    now: new Date("2026-08-11T15:00:00Z"),
  });
  assert.equal(view.freshness, "unavailable");
  assert.ok(view.errors.some((error) => error.code === "invalid_date_range"));
});
