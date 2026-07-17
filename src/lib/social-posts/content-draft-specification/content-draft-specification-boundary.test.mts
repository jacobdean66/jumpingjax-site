import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_FILES = [
  "content-draft-specification-domain.ts",
  "content-draft-specification-service.ts",
  "content-draft-specification-replay.ts",
  "content-draft-specification-diagnostics.ts",
  "content-draft-specification-types.ts",
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
  "openai-creative-director",
  "social-agent",
] as const;

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["'][^"']*openai-creative-director[^"']*["']/,
  /from\s+["'][^"']*social-agent[^"']*["']/,
  /from\s+["'][^"']*video-engine[^"']*["']/,
  /from\s+["'][^"']*video-director[^"']*["']/,
  /from\s+["'][^"']*@supabase[^"']*["']/,
  /from\s+["'][^"']*openai[^"']*["']/,
  /require\(\s*["'][^"']*openai[^"']*["']\s*\)/,
] as const;

test("content draft specification is a pure read-only intelligence boundary", () => {
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

test("content draft specification module files do not reach forbidden sibling modules", () => {
  const moduleFiles = readdirSync(DIRECTORY).filter((name) => name.endsWith(".ts"));
  for (const fileName of moduleFiles) {
    if (fileName.endsWith(".test.mts")) continue;
    const source = readFileSync(`${DIRECTORY}${fileName}`, "utf8");
    assert.doesNotMatch(source, /openai-creative-director/);
    assert.doesNotMatch(source, /video-engine/);
    assert.doesNotMatch(source, /social-agent/);
    assert.doesNotMatch(source, /publication-publisher/);
    assert.doesNotMatch(source, /execution-runner/);
  }
});
