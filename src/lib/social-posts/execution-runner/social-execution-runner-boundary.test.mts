import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RUNNER_SOURCE_FILES = [
  "social-execution-runner-domain.ts",
  "social-execution-runner-preflight.ts",
  "social-execution-runner-service.ts",
  "social-execution-runner-replay.ts",
  "social-execution-runner-diagnostics.ts",
  "social-execution-runner-store.ts",
] as const;

test("execution runner modules contain no forbidden network or credential imports", () => {
  const directory = fileURLToPath(new URL(".", import.meta.url));

  for (const fileName of RUNNER_SOURCE_FILES) {
    const source = readFileSync(`${directory}/${fileName}`, "utf8");
    assert.equal(source.includes("fetch("), false, `${fileName} must not call fetch()`);
    assert.equal(source.includes("/oauth/"), false, `${fileName} must not import oauth modules`);
    assert.equal(source.includes("/credentials/"), false, `${fileName} must not import credential modules`);
    assert.equal(source.includes("graph.facebook.com"), false, `${fileName} must not reference Graph API`);
  }
});
