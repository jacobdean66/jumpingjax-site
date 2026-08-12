import assert from "node:assert/strict";
import test from "node:test";

import {
  isDurableAgentStoreConfigured,
  resetDurableAgentStoreReadyCacheForTests,
} from "./agent-durable-store";
import {
  billableModelProtectionBlock,
  getAgentProtectionMode,
  paidGenerationProtectionBlock,
} from "./agent-protection-mode";
import { getAgentUiProtectionStatus } from "./agent-ui-protection";

function env(vars: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}

test("production without Supabase credentials stays disabled", () => {
  const mode = getAgentProtectionMode(
    env({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL: "1",
    }),
  );
  assert.equal(mode.kind, "disabled");
  assert.equal(mode.durable, false);
});

test("production with Supabase credentials selects durable-supabase mode", () => {
  const mode = getAgentProtectionMode(
    env({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    }),
  );
  assert.equal(mode.kind, "durable-supabase");
  assert.equal(mode.durable, true);
});

test("SOCIAL_AGENT_DURABLE_PROTECTION=0 forces disabled even with credentials", () => {
  assert.equal(
    isDurableAgentStoreConfigured(
      env({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        SOCIAL_AGENT_DURABLE_PROTECTION: "0",
      }),
    ),
    false,
  );
  const mode = getAgentProtectionMode(
    env({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      SOCIAL_AGENT_DURABLE_PROTECTION: "0",
    }),
  );
  assert.equal(mode.kind, "disabled");
});

test("process-local override cannot enable Maps on Vercel production", () => {
  const mode = getAgentProtectionMode(
    env({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL: "1",
      AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
    }),
  );
  assert.equal(mode.kind, "disabled");
});

test("local development still allows process-local protection", () => {
  const mode = getAgentProtectionMode(
    env({
      NODE_ENV: "development",
    }),
  );
  assert.equal(mode.kind, "process-local-nonproduction");
});

test("billable gates fail closed when durable mode is selected but store is not ready", async () => {
  resetDurableAgentStoreReadyCacheForTests();
  const productionEnv = env({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    VERCEL: "1",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  });

  const modelBlock = await billableModelProtectionBlock(productionEnv);
  const paidBlock = await paidGenerationProtectionBlock(productionEnv);
  assert.ok(modelBlock);
  assert.ok(paidBlock);
  assert.equal(modelBlock?.code, "durable_protection_unavailable");
  assert.equal(paidBlock?.code, "durable_protection_unavailable");
});

test("UI status disables model actions when durable store is not ready", async () => {
  resetDurableAgentStoreReadyCacheForTests();
  const status = await getAgentUiProtectionStatus(
    env({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    }),
  );
  assert.equal(status.modelActionsDisabled, true);
  assert.match(status.reason ?? "", /Unavailable until durable/);
  assert.equal(status.mode.kind, "durable-supabase");
});

test("UI status enables model actions in local process-local mode", async () => {
  const status = await getAgentUiProtectionStatus(
    env({
      NODE_ENV: "development",
    }),
  );
  assert.equal(status.modelActionsDisabled, false);
  assert.equal(status.reason, null);
  assert.equal(status.mode.kind, "process-local-nonproduction");
});

test("async idempotency refuses process-local Maps when durable protection is disabled", async () => {
  const { beginAgentIdempotentActionAsync } = await import("./agent-idempotency");
  const { DurableAgentStoreError } = await import("./agent-durable-store");
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL: process.env.VERCEL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AGENT_ALLOW_PROCESS_LOCAL_PROTECTION:
      process.env.AGENT_ALLOW_PROCESS_LOCAL_PROTECTION,
  };
  try {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL = "1";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.AGENT_ALLOW_PROCESS_LOCAL_PROTECTION;
    await assert.rejects(
      () =>
        beginAgentIdempotentActionAsync({
          clientKey: "client",
          action: "agent-draft",
          idempotencyKey: null,
          fingerprint: "fp-1",
        }),
      (error: unknown) => error instanceof DurableAgentStoreError,
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
