import assert from "node:assert/strict";
import test from "node:test";

import { pollAikidoScanStatus, requestAikidoScan } from "./aikido-client.ts";
import { resolveOpenAIClientOptions, resolveProtectedOpenAIConfig } from "./protected-openai-config.ts";

const MANAGED_KEYS = [
  "AITHURA_BASE_URL",
  "AITHURA_API_KEY",
  "AITHURA_PROVIDER",
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "ALLOW_DIRECT_OPENAI",
  "AIKIDO_CI_SECRET",
  "AIKIDO_REPOSITORY_ID",
  "AIKIDO_BRANCH_NAME",
  "AIKIDO_MANUAL_SCAN_ENABLED",
  "AIKIDO_BASE_COMMIT_ID",
  "AIKIDO_HEAD_COMMIT_ID",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_REF",
] as const;

function withEnv(values: Partial<Record<(typeof MANAGED_KEYS)[number], string>>, run: () => Promise<void> | void) {
  const before = Object.fromEntries(MANAGED_KEYS.map((key) => [key, process.env[key]]));
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  return Promise.resolve(run()).finally(() => {
    for (const key of MANAGED_KEYS) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("protected OpenAI routing fails closed unless direct access is explicitly opted in", async () => {
  await withEnv({ OPENAI_API_KEY: "direct-key" }, () => {
    assert.equal(resolveProtectedOpenAIConfig(), null);
    assert.equal(resolveOpenAIClientOptions(), null);
  });
  await withEnv({ OPENAI_API_KEY: "direct-key", ALLOW_DIRECT_OPENAI: "true" }, () => {
    assert.equal(resolveOpenAIClientOptions()?.baseURL, "https://api.openai.com/v1");
  });
});

test("official AITHURA route pins the provider header", async () => {
  await withEnv({
    AITHURA_BASE_URL: "https://api.aithura.com/v1",
    AITHURA_API_KEY: "aithura_live_test",
    AITHURA_PROVIDER: "malicious\r\nheader",
  }, () => {
    const config = resolveProtectedOpenAIConfig();
    assert.equal(config?.route, "aithura");
    assert.deepEqual(config?.defaultHeaders, { "x-aithura-provider": "openai" });
  });
});

test("Aikido scan rejects a stale deployment without an upstream call", async () => {
  await withEnv({
    AIKIDO_CI_SECRET: "secret",
    AIKIDO_REPOSITORY_ID: "repo",
    AIKIDO_BRANCH_NAME: "main",
    AIKIDO_MANUAL_SCAN_ENABLED: "true",
    VERCEL_GIT_COMMIT_SHA: "not-a-commit",
    VERCEL_GIT_COMMIT_REF: "main",
  }, async () => {
    let calls = 0;
    const result = await requestAikidoScan(async () => {
      calls += 1;
      throw new Error("must not call");
    });
    assert.equal(result.accepted, false);
    assert.equal(calls, 0);
  });
});

test("Aikido scan binds its request to the current deployment", async () => {
  const head = "a".repeat(40);
  const base = "b".repeat(40);
  await withEnv({
    AIKIDO_CI_SECRET: "secret",
    AIKIDO_REPOSITORY_ID: "repo",
    AIKIDO_BRANCH_NAME: "main",
    AIKIDO_MANUAL_SCAN_ENABLED: "true",
    VERCEL_GIT_COMMIT_SHA: head,
    VERCEL_GIT_COMMIT_REF: "main",
  }, async () => {
    let calls = 0;
    const result = await requestAikidoScan(async (_url, init) => {
      calls += 1;
      if (calls === 1) {
        assert.equal(init?.method, "GET");
        return new Response(JSON.stringify({ sha: head, parents: [{ sha: base }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("X-AIK-API-SECRET"), "secret");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.head_commit_id, head);
      assert.equal(body.base_commit_id, base);
      return new Response(JSON.stringify({ scan_id: 17 }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    assert.equal(calls, 2);
    assert.deepEqual(result, { accepted: true, scanId: 17, message: "Aikido accepted the production repository scan." });
  });
});

test("Aikido polling distinguishes completed findings from a passing scan", async () => {
  await withEnv({ AIKIDO_CI_SECRET: "secret" }, async () => {
    const status = await pollAikidoScanStatus(17, async () => new Response(
      JSON.stringify({ all_scans_completed: true, gate_passed: false, new_issues_found: 2 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    assert.equal(status.completed, true);
    assert.equal(status.passed, false);
    assert.equal(status.issueCount, 2);
    assert.equal(status.detailsUrl, null);
  });
});
