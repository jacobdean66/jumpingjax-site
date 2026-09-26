import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const PAGE_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/seasonal-intelligence/page.tsx`,
  "utf8",
);
const NAV_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/SocialPostsNav.tsx`,
  "utf8",
);

test("seasonal admin page uses established authenticated server rendering", () => {
  assert.match(PAGE_SOURCE, /verifyAdminAccess\(token\)/);
  assert.match(PAGE_SOURCE, /AdminAuthError/);
  assert.match(PAGE_SOURCE, /listSocialPosts\(\)/);
  assert.match(PAGE_SOURCE, /replayMarketingMemory/);
  assert.match(PAGE_SOURCE, /replaySeasonalIntelligence/);
});

test("seasonal admin page is informational and exposes no mutation controls", () => {
  assert.doesNotMatch(PAGE_SOURCE, /<form/i);
  assert.doesNotMatch(PAGE_SOURCE, /<button/i);
  assert.doesNotMatch(PAGE_SOURCE, /\baction=/i);
  assert.doesNotMatch(PAGE_SOURCE, /\bmethod=/i);
  assert.doesNotMatch(PAGE_SOURCE, /\bfetch\(/i);
});

test("social posts navigation links to the authenticated seasonal intelligence page", () => {
  assert.match(NAV_SOURCE, /\/admin\/social-posts\/seasonal-intelligence/);
  assert.match(NAV_SOURCE, /Seasonal intelligence/);
});
