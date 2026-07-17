import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_FILES = [
  "asset-intelligence-domain.ts",
  "asset-intelligence-service.ts",
  "asset-intelligence-replay.ts",
  "asset-intelligence-diagnostics.ts",
  "asset-intelligence-types.ts",
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
  "credential",
  "vault",
  "approveSocial",
  "saveApproval",
  "queue",
  "cron",
  "uploadSocial",
  "removeAsset",
  "deleteObject",
  "generateImage",
] as const;

test("asset intelligence is a pure read-only intelligence boundary", () => {
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
