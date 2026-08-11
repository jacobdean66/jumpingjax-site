import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  META_AD_ANALYTICS_OAUTH_TARGET_ID,
  SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES,
  SOCIAL_META_PUBLICATION_OAUTH_SCOPES,
  intentRequestsPublishingScopes,
  isAllowlistedOAuthReturnPath,
  oauthReturnPathForPurpose,
  resolveOAuthPurposeFromIntent,
  scopesForOAuthPurpose,
} from "./social-oauth-purpose";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

test("analytics scopes are ads_read only and exclude publishing", () => {
  assert.deepEqual([...SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES], ["ads_read"]);
  assert.equal(SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES.includes("ads_management" as never), false);
  for (const scope of [
    "pages_manage_posts",
    "instagram_content_publish",
    "instagram_basic",
    "pages_show_list",
  ]) {
    assert.equal(
      (SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES as readonly string[]).includes(scope),
      false,
    );
  }
});

test("publication scopes retain publishing permissions and exclude ads_read", () => {
  assert.ok(SOCIAL_META_PUBLICATION_OAUTH_SCOPES.includes("pages_manage_posts"));
  assert.ok(SOCIAL_META_PUBLICATION_OAUTH_SCOPES.includes("instagram_content_publish"));
  assert.equal(
    (SOCIAL_META_PUBLICATION_OAUTH_SCOPES as readonly string[]).includes("ads_read"),
    false,
  );
});

test("purpose helpers separate analytics and publication return paths", () => {
  assert.equal(
    resolveOAuthPurposeFromIntent({
      publicationTargetId: META_AD_ANALYTICS_OAUTH_TARGET_ID,
      scopes: ["ads_read"],
    }),
    "ad_analytics",
  );
  assert.equal(
    resolveOAuthPurposeFromIntent({
      publicationTargetId: "d9be61cc-137d-4f47-87c9-43023bc58c85",
      scopes: [...SOCIAL_META_PUBLICATION_OAUTH_SCOPES],
    }),
    "publication",
  );
  assert.equal(
    oauthReturnPathForPurpose("ad_analytics", "oauth=connected"),
    "/admin/ad-analytics?oauth=connected",
  );
  assert.equal(
    oauthReturnPathForPurpose("publication", "oauth=connected"),
    "/admin/social-posts/publication-execution?oauth=connected",
  );
  assert.equal(isAllowlistedOAuthReturnPath("/admin/ad-analytics?oauth=ok"), true);
  assert.equal(isAllowlistedOAuthReturnPath("https://evil.example/phish"), false);
  assert.equal(intentRequestsPublishingScopes(scopesForOAuthPurpose("ad_analytics")), false);
  assert.equal(intentRequestsPublishingScopes(scopesForOAuthPurpose("publication")), true);
});

test("analytics connect route is owner-gated and purpose-bound", () => {
  const route = read("src/app/api/admin/ad-analytics/oauth/connect/route.ts");
  assert.match(route, /verifyAdminOwnerAccess/);
  assert.match(route, /purpose:\s*"ad_analytics"/);
  assert.match(route, /META_OAUTH_PURPOSE_COOKIE/);
  assert.doesNotMatch(route, /pages_manage_posts|instagram_content_publish|ads_management/);
});

test("callback route clears purpose cookie and never forwards code/state", () => {
  const route = read("src/app/api/admin/social-oauth/callback/route.ts");
  assert.match(route, /purposeHint/);
  assert.match(route, /maxAge:\s*0/);
  assert.doesNotMatch(route, /searchParams\.set\("code"/);
  assert.doesNotMatch(route, /searchParams\.set\("state"/);
});

test("ad analytics page exposes Connect Meta for Analytics control", () => {
  const page = read("src/app/admin/ad-analytics/page.tsx");
  assert.match(page, /Connect Meta for Analytics/);
  assert.match(page, /\/api\/admin\/ad-analytics\/oauth\/connect/);
  assert.doesNotMatch(page, /Publication execution → Meta OAuth/);
});
