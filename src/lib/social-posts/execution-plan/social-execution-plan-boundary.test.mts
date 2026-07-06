import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PLAN_SOURCE_FILES = [
  "social-execution-plan-domain.ts",
  "social-execution-plan-preflight.ts",
  "social-execution-plan-service.ts",
  "social-execution-plan-replay.ts",
  "social-execution-plan-diagnostics.ts",
  "social-execution-plan-store.ts",
] as const;

test("execution plan modules contain no forbidden network or credential imports", () => {
  const directory = fileURLToPath(new URL(".", import.meta.url));

  for (const fileName of PLAN_SOURCE_FILES) {
    const source = readFileSync(`${directory}/${fileName}`, "utf8");
    assert.equal(source.includes("fetch("), false, `${fileName} must not call fetch()`);
    assert.equal(source.includes("/oauth/"), false, `${fileName} must not import oauth modules`);
    assert.equal(source.includes("/credentials/"), false, `${fileName} must not import credential modules`);
    assert.equal(source.includes("graph.facebook.com"), false, `${fileName} must not reference Graph API`);
    assert.equal(source.includes("node-cron"), false, `${fileName} must not use cron`);
    assert.equal(source.includes("Worker("), false, `${fileName} must not spawn workers`);
    assert.equal(source.includes("setInterval("), false, `${fileName} must not schedule background work`);
    assert.equal(source.includes("setTimeout("), false, `${fileName} must not schedule background work`);
  }
});

test("execution plan service does not orchestrate runner or adapter simulation", () => {
  const directory = fileURLToPath(new URL(".", import.meta.url));
  const source = readFileSync(`${directory}/social-execution-plan-service.ts`, "utf8");

  assert.equal(source.includes("executeDryRunExecutionRunner"), false);
  assert.equal(source.includes("simulateDryRunSocialPublicationExecutionAdapterRequest"), false);
  assert.equal(source.includes("orchestrateDryRunExecutionSession"), false);
  assert.equal(source.includes("/scheduler/"), false);
  assert.equal(source.includes("publishSocial"), false);
  assert.ok(
    source.includes("evaluateExecutionRunnerPreflight") ||
      source.includes("evaluateExecutionPlanPreflight"),
  );
});
