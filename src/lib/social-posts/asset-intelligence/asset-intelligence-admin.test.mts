import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const PAGE_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/asset-intelligence/page.tsx`,
  "utf8",
);
const HUB_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/page.tsx`,
  "utf8",
);
const PLANNER_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/campaign-planner/page.tsx`,
  "utf8",
);

test("asset admin page uses established authenticated server rendering", () => {
  assert.match(PAGE_SOURCE, /verifyAdminAccess\(token\)/);
  assert.match(PAGE_SOURCE, /AdminAuthError/);
  assert.match(PAGE_SOURCE, /listSocialPosts\(\)/);
  assert.match(PAGE_SOURCE, /replayMarketingMemory/);
  assert.match(PAGE_SOURCE, /replayAssetIntelligence/);
});

test("asset admin page is informational and exposes no mutation controls", () => {
  assert.doesNotMatch(PAGE_SOURCE, /<form/i);
  assert.doesNotMatch(PAGE_SOURCE, /<button/i);
  assert.doesNotMatch(PAGE_SOURCE, /\baction=/i);
  assert.doesNotMatch(PAGE_SOURCE, /\bmethod=/i);
  assert.doesNotMatch(PAGE_SOURCE, /\bfetch\(/i);
  assert.doesNotMatch(PAGE_SOURCE, /type=["']file["']/i);
  assert.doesNotMatch(PAGE_SOURCE, /generateImage/i);
  assert.doesNotMatch(PAGE_SOURCE, /publishSocial/i);
  assert.doesNotMatch(PAGE_SOURCE, /scheduleSocialPost/i);
});

test("social posts hub links to the authenticated asset intelligence page", () => {
  assert.match(HUB_SOURCE, /\/admin\/social-posts\/asset-intelligence/);
  assert.match(HUB_SOURCE, /Asset intelligence/);
});

test("campaign planner page surfaces asset readiness summary", () => {
  assert.match(PLANNER_SOURCE, /Asset readiness summary/);
  assert.match(PLANNER_SOURCE, /readyAssetCampaignCount/);
});
