import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_FILES = [
  "draft-compliance-validator-domain.ts",
  "draft-compliance-validator-service.ts",
  "draft-compliance-validator-replay.ts",
  "draft-compliance-validator-diagnostics.ts",
  "draft-compliance-validator-types.ts",
  "draft-compliance-validator-fixtures.ts",
] as const;

const FORBIDDEN_PATTERNS = [
  "fetch(",
  "createServiceRoleClient",
  ".insert(",
  ".update(",
  ".upsert(",
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
  "video-engine",
  "video-director",
  "image-director",
  "image-provider",
  "openai-creative-director",
  "social-agent",
  "createSocialPost",
  "execution-runner",
  "execution-session",
  "execution-plan",
  "localStorage",
  "sessionStorage",
] as const;

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["'][^"']*openai-creative-director[^"']*["']/,
  /from\s+["'][^"']*social-agent[^"']*["']/,
  /from\s+["'][^"']*video-engine[^"']*["']/,
  /from\s+["'][^"']*video-director[^"']*["']/,
  /from\s+["'][^"']*image-director[^"']*["']/,
  /from\s+["'][^"']*image-provider[^"']*["']/,
  /from\s+["'][^"']*social-owner-approval[^"']*["']/,
  /from\s+["'][^"']*social-campaign-memory-promotion[^"']*["']/,
  /from\s+["'][^"']*social-publication-scheduler[^"']*["']/,
  /from\s+["'][^"']*social-publication-publisher[^"']*["']/,
  /from\s+["'][^"']*@supabase[^"']*["']/,
  /from\s+["'][^"']*openai[^"']*["']/,
  /require\(\s*["'][^"']*openai[^"']*["']\s*\)/,
] as const;

test("draft compliance validator is a pure read-only intelligence boundary", () => {
  for (const fileName of SOURCE_FILES) {
    const source = readFileSync(`${DIRECTORY}${fileName}`, "utf8");
    const lower = source.toLowerCase();
    for (const pattern of FORBIDDEN_PATTERNS) {
      assert.equal(
        lower.includes(pattern.toLowerCase()),
        false,
        `${fileName} must not include ${pattern}`,
      );
    }
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.equal(
        pattern.test(source),
        false,
        `${fileName} must not import ${pattern}`,
      );
    }
  }
});

test("draft compliance validator module files do not reach forbidden sibling modules", () => {
  const moduleFiles = readdirSync(DIRECTORY).filter((name) => name.endsWith(".ts"));
  for (const fileName of moduleFiles) {
    if (fileName.endsWith(".test.mts")) continue;
    const source = readFileSync(`${DIRECTORY}${fileName}`, "utf8");
    assert.doesNotMatch(source, /openai-creative-director/);
    assert.doesNotMatch(source, /video-engine/);
    assert.doesNotMatch(source, /social-agent/);
    assert.doesNotMatch(source, /publication-publisher/);
    assert.doesNotMatch(source, /execution-runner/);
    assert.doesNotMatch(source, /createSocialPost/);
  }
});
