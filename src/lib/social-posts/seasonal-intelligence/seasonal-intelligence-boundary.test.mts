import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_FILES = [
  "seasonal-intelligence-domain.ts",
  "seasonal-intelligence-service.ts",
  "seasonal-intelligence-replay.ts",
  "seasonal-intelligence-diagnostics.ts",
  "seasonal-intelligence-types.ts",
  "seasonal-intelligence-calendar.ts",
] as const;

const FORBIDDEN_PATTERNS = [
  "fetch(",
  "createServiceRoleClient",
  ".insert(",
  ".update(",
  ".delete(",
  "openai",
  "replicate",
  "oauth",
  "graph.facebook.com",
  "node-cron",
  "Worker(",
  "setInterval(",
  "setTimeout(",
  "publishSocial",
  "scheduleSocialPost",
] as const;

test("seasonal intelligence is a pure read-only intelligence boundary", () => {
  for (const fileName of SOURCE_FILES) {
    const source = readFileSync(`${DIRECTORY}${fileName}`, "utf8").toLowerCase();
    for (const pattern of FORBIDDEN_PATTERNS) {
      assert.equal(
        source.includes(pattern.toLowerCase()),
        false,
        `${fileName} must not include ${pattern}`,
      );
    }
  }
});
