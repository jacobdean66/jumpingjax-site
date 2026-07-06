import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEYS,
  SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEY_SET,
  SOCIAL_EXECUTION_READ_ONLY_LAYER_INVARIANTS,
} from "./social-execution-core-invariants";

const SOCIAL_POSTS_ROOT = fileURLToPath(new URL("..", import.meta.url));

const PLAN_LAYER_FILES = [
  "execution-plan/social-execution-plan-domain.ts",
  "execution-plan/social-execution-plan-preflight.ts",
  "execution-plan/social-execution-plan-service.ts",
  "execution-plan/social-execution-plan-replay.ts",
  "execution-plan/social-execution-plan-diagnostics.ts",
  "execution-plan/social-execution-plan-store.ts",
] as const;

const FORBIDDEN_SOURCE_PATTERNS = [
  { pattern: "fetch(", label: "fetch()" },
  { pattern: "/oauth/", label: "oauth modules" },
  { pattern: "/credentials/", label: "credential modules" },
  { pattern: "graph.facebook.com", label: "Graph API" },
  { pattern: "node-cron", label: "cron" },
  { pattern: "Worker(", label: "workers" },
  { pattern: "setInterval(", label: "background timers" },
  { pattern: "setTimeout(", label: "background timers" },
] as const;

function readLayerSource(relativePath: string): string {
  return readFileSync(`${SOCIAL_POSTS_ROOT}/${relativePath}`, "utf8");
}

test("execution core forbidden key set is a stable superset", () => {
  assert.ok(SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEY_SET.has("publish"));
  assert.ok(SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEY_SET.has("oauth"));
  assert.ok(SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEY_SET.has("secret"));
  assert.equal(SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEYS.length, 16);
});

test("read-only layer invariants remain fail-closed", () => {
  assert.equal(SOCIAL_EXECUTION_READ_ONLY_LAYER_INVARIANTS.grantsExecutionPermission, false);
  assert.equal(SOCIAL_EXECUTION_READ_ONLY_LAYER_INVARIANTS.executesNothing, true);
  assert.equal(SOCIAL_EXECUTION_READ_ONLY_LAYER_INVARIANTS.publishesNothing, true);
  assert.equal(SOCIAL_EXECUTION_READ_ONLY_LAYER_INVARIANTS.readOnly, true);
});

test("execution plan layer must not execute runner or adapter simulation", () => {
  const serviceSource = readLayerSource("execution-plan/social-execution-plan-service.ts");
  const preflightSource = readLayerSource("execution-plan/social-execution-plan-preflight.ts");

  for (const forbidden of [
    "executeDryRunExecutionRunner",
    "orchestrateDryRunExecutionSession",
    "simulateDryRunSocialPublicationExecutionAdapterRequest",
    "publishSocial",
  ] as const) {
    assert.equal(
      serviceSource.includes(forbidden),
      false,
      `plan service must not reference ${forbidden}`,
    );
    assert.equal(
      preflightSource.includes(forbidden),
      false,
      `plan preflight must not reference ${forbidden}`,
    );
  }

  assert.ok(
    serviceSource.includes("evaluateExecutionRunnerPreflight") ||
      serviceSource.includes("evaluateExecutionPlanPreflight"),
    "plan service may compose read-only runner preflight only",
  );
  assert.ok(
    preflightSource.includes("evaluateExecutionSessionPreflight"),
    "plan preflight must compose session preflight read-only",
  );
  assert.ok(
    preflightSource.includes("evaluateExecutionRunnerPreflight"),
    "plan preflight may compose runner preflight read-only",
  );
});

test("execution plan modules contain no forbidden network or credential access", () => {
  for (const relativePath of PLAN_LAYER_FILES) {
    const source = readLayerSource(relativePath);
    const fileName = relativePath.split("/").pop() ?? relativePath;

    for (const { pattern, label } of FORBIDDEN_SOURCE_PATTERNS) {
      assert.equal(
        source.includes(pattern),
        false,
        `${fileName} must not use ${label}`,
      );
    }
  }
});

test("runner and session domain files import shared forbidden keys from execution core", () => {
  const runnerDomain = readLayerSource("execution-runner/social-execution-runner-domain.ts");
  const sessionDomain = readLayerSource("execution-session/social-execution-session-domain.ts");
  const planDomain = readLayerSource("execution-plan/social-execution-plan-domain.ts");

  for (const source of [runnerDomain, sessionDomain, planDomain]) {
    assert.ok(
      source.includes("execution-core/social-execution-core"),
      "domain must use execution-core shared invariants",
    );
  }
});
