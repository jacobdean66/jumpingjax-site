import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const PAGE_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/creative-brief-intelligence/page.tsx`,
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

test("creative brief admin page uses established authenticated server rendering", () => {
  assert.match(PAGE_SOURCE, /verifyAdminAccess\(token\)/);
  assert.match(PAGE_SOURCE, /AdminAuthError/);
  assert.match(PAGE_SOURCE, /listSocialPosts\(\)/);
  assert.match(PAGE_SOURCE, /replayCreativeBriefIntelligence/);
});

test("creative brief admin page is informational and exposes no mutation controls", () => {
  assert.doesNotMatch(PAGE_SOURCE, /<form/i);
  assert.doesNotMatch(PAGE_SOURCE, /<button/i);
  assert.doesNotMatch(PAGE_SOURCE, /\baction=/i);
  assert.doesNotMatch(PAGE_SOURCE, /\bmethod=/i);
  assert.doesNotMatch(PAGE_SOURCE, /\bfetch\(/i);
  assert.doesNotMatch(PAGE_SOURCE, /type=["']file["']/i);
  assert.doesNotMatch(PAGE_SOURCE, /generateImage/i);
  assert.doesNotMatch(PAGE_SOURCE, /publishSocial/i);
  assert.doesNotMatch(PAGE_SOURCE, /scheduleSocialPost/i);
  assert.doesNotMatch(PAGE_SOURCE, /approveSocial/i);
});

test("social posts hub links to the authenticated creative brief intelligence page", () => {
  assert.match(HUB_SOURCE, /\/admin\/social-posts\/creative-brief-intelligence/);
  assert.match(HUB_SOURCE, /Creative brief intelligence/);
});

test("campaign planner page links to creative brief intelligence", () => {
  assert.match(PLANNER_SOURCE, /\/admin\/social-posts\/creative-brief-intelligence/);
  assert.match(PLANNER_SOURCE, /Creative brief intelligence/);
});
