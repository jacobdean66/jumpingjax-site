import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const PAGE_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/draft-compliance-validator/page.tsx`,
  "utf8",
);
const HUB_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/page.tsx`,
  "utf8",
);
const SPEC_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/content-draft-specification/page.tsx`,
  "utf8",
);
const NAV_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/SocialPostsNav.tsx`,
  "utf8",
);

test("draft compliance validator admin page uses established authenticated server rendering", () => {
  assert.match(PAGE_SOURCE, /verifyAdminAccess\(token\)/);
  assert.match(PAGE_SOURCE, /AdminAuthError/);
  assert.match(PAGE_SOURCE, /listSocialPosts\(\)/);
  assert.match(PAGE_SOURCE, /replayDraftComplianceValidator/);
  assert.match(PAGE_SOURCE, /listDraftComplianceFixtureCandidates/);
  assert.match(PAGE_SOURCE, /FIXTURE_AS_OF/);
});

test("draft compliance validator admin page is informational and exposes no mutation controls", () => {
  assert.doesNotMatch(PAGE_SOURCE, /<form/i);
  assert.doesNotMatch(PAGE_SOURCE, /<button/i);
  assert.doesNotMatch(PAGE_SOURCE, /<input/i);
  assert.doesNotMatch(PAGE_SOURCE, /<textarea/i);
  assert.doesNotMatch(PAGE_SOURCE, /\baction=/i);
  assert.doesNotMatch(PAGE_SOURCE, /\bmethod=/i);
  assert.doesNotMatch(PAGE_SOURCE, /\bfetch\(/i);
  assert.doesNotMatch(PAGE_SOURCE, /type=["']file["']/i);
  assert.doesNotMatch(PAGE_SOURCE, /generateImage/i);
  assert.doesNotMatch(PAGE_SOURCE, /publishSocial/i);
  assert.doesNotMatch(PAGE_SOURCE, /scheduleSocialPost/i);
  assert.doesNotMatch(PAGE_SOURCE, /approveSocial/i);
  assert.doesNotMatch(PAGE_SOURCE, /saveDraft/i);
  assert.doesNotMatch(PAGE_SOURCE, /createAttempt/i);
  assert.doesNotMatch(PAGE_SOURCE, /type=["']submit["']/i);
  assert.doesNotMatch(PAGE_SOURCE, /export async function POST/);
  assert.match(PAGE_SOURCE, /Non-publishable review artifacts/i);
  assert.match(PAGE_SOURCE, /does not grant generation or\s+publishing authority/i);
});

test("draft compliance validator admin page renders fixture evaluations", () => {
  assert.match(PAGE_SOURCE, /evaluations\.map\(\(evaluation\) =>/);
  assert.match(PAGE_SOURCE, /blockingViolations/);
  assert.match(PAGE_SOURCE, /advisoryFindings/);
  assert.match(PAGE_SOURCE, /underlyingReadiness/);
  assert.match(PAGE_SOURCE, /resultState/);
});

test("social posts hub links to the authenticated draft compliance validator page", () => {
  assert.match(HUB_SOURCE, /SocialPostsPageHeader/);
  assert.match(NAV_SOURCE, /\/admin\/social-posts\/draft-compliance-validator/);
  assert.match(NAV_SOURCE, /Draft compliance validator/i);
});

test("content draft specification page links to draft compliance validator", () => {
  assert.match(SPEC_SOURCE, /SocialPostsPageHeader/);
  assert.match(NAV_SOURCE, /\/admin\/social-posts\/draft-compliance-validator/);
  assert.match(NAV_SOURCE, /Draft compliance validator/i);
});
