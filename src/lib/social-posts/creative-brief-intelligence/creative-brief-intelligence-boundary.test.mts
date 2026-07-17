import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_FILES = [
  "creative-brief-intelligence-domain.ts",
  "creative-brief-intelligence-service.ts",
  "creative-brief-intelligence-replay.ts",
  "creative-brief-intelligence-diagnostics.ts",
  "creative-brief-intelligence-types.ts",
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
  "Date.now(",
  "Math.random(",
  "randomUUID",
  "publishSocial",
  "scheduleSocialPost",
  "credential",
  "vault",
  "approveSocial",
  "saveApproval",
  "queue",
  "cron",
  "uploadSocial",
  "generateImage",
  "process.env",
] as const;

test("creative brief intelligence is a pure read-only intelligence boundary", () => {
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
