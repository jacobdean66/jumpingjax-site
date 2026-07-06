import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SESSION_SOURCE_FILES = [
  "social-execution-session-domain.ts",
  "social-execution-session-preflight.ts",
  "social-execution-session-service.ts",
  "social-execution-session-replay.ts",
  "social-execution-session-diagnostics.ts",
  "social-execution-session-store.ts",
] as const;

test("execution session modules contain no forbidden network or credential imports", () => {
  const directory = fileURLToPath(new URL(".", import.meta.url));

  for (const fileName of SESSION_SOURCE_FILES) {
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

test("execution session service orchestrates through dry-run runner only", () => {
  const directory = fileURLToPath(new URL(".", import.meta.url));
  const source = readFileSync(`${directory}/social-execution-session-service.ts`, "utf8");

  assert.ok(source.includes("executeDryRunExecutionRunner"));
  assert.equal(source.includes("/scheduler/"), false);
  assert.equal(source.includes("publishSocial"), false);
});
