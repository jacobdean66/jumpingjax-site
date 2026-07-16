import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_FILES = [
  "marketing-memory-domain.ts",
  "marketing-memory-service.ts",
  "marketing-memory-replay.ts",
  "marketing-memory-diagnostics.ts",
  "marketing-memory-types.ts",
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
] as const;

test("marketing memory is a pure read-only intelligence boundary", () => {
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
