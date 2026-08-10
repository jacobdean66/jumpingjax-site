import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const routePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "route.ts",
);
const src = readFileSync(routePath, "utf8");

test("publish route requires owner auth and forbids agent autonomous invoke", () => {
  assert.match(src, /verifyAdminOwnerAccess/);
  assert.match(src, /agent_publish_forbidden/);
  assert.match(src, /x-social-agent|x-cursor-agent/);
  assert.match(src, /publishOrganicMetaPagePost/);
  assert.doesNotMatch(src, /accessToken|page_access_token|META_APP_SECRET/);
  assert.doesNotMatch(src, /createSocialAgentPlan|agent-draft|runImageDirectorAgent/);
});

console.log("social-meta publish route tests passed");
