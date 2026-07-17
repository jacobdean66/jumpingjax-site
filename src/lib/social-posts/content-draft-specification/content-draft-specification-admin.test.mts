import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const PAGE_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/content-draft-specification/page.tsx`,
  "utf8",
);
const HUB_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/page.tsx`,
  "utf8",
);
const BRIEF_SOURCE = readFileSync(
  `${DIRECTORY}../../../app/admin/social-posts/creative-brief-intelligence/page.tsx`,
  "utf8",
);

test("content draft specification admin page uses established authenticated server rendering", () => {
  assert.match(PAGE_SOURCE, /verifyAdminAccess\(token\)/);
  assert.match(PAGE_SOURCE, /AdminAuthError/);
  assert.match(PAGE_SOURCE, /listSocialPosts\(\)/);
  assert.match(PAGE_SOURCE, /replayContentDraftSpecification/);
});

test("content draft specification admin page is informational and exposes no mutation controls", () => {
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
  assert.doesNotMatch(PAGE_SOURCE, /saveDraft/i);
  assert.doesNotMatch(PAGE_SOURCE, /createAttempt/i);
  assert.doesNotMatch(PAGE_SOURCE, /type=["']submit["']/i);
  assert.match(PAGE_SOURCE, /Non-publishable specification/i);
});

test("content draft specification admin page renders structured accessibility requirements", () => {
  assert.match(PAGE_SOURCE, /Accessibility requirements/);
  assert.match(PAGE_SOURCE, /spec\.accessibilityRequirements/);
  assert.match(PAGE_SOURCE, /item\.requirementId/);
  assert.match(PAGE_SOURCE, /item\.status/);
  assert.match(PAGE_SOURCE, /item\.description/);
  assert.match(PAGE_SOURCE, /None recorded for this specification/);
  assert.match(PAGE_SOURCE, /accessibilityRequirements\.length === 0/);
});

test("content draft specification admin page preserves planner rank and score display", () => {
  assert.match(PAGE_SOURCE, /Rank \{spec\.plannerRank\}/);
  assert.match(PAGE_SOURCE, /\{spec\.plannerScore\}/);
  assert.match(PAGE_SOURCE, /specifications\.map\(\(spec\) =>/);
});

test("social posts hub links to the authenticated content draft specification page", () => {
  assert.match(HUB_SOURCE, /\/admin\/social-posts\/content-draft-specification/);
  assert.match(HUB_SOURCE, /Content draft specification/i);
});

test("creative brief intelligence page links to content draft specification", () => {
  assert.match(BRIEF_SOURCE, /\/admin\/social-posts\/content-draft-specification/);
  assert.match(BRIEF_SOURCE, /Content draft specification/i);
});
