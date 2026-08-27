import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  META_AD_ANALYTICS_OAUTH_TARGET_ID,
  SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES,
  SOCIAL_META_PUBLICATION_OAUTH_SCOPES,
  intentRequestsAdsRead,
  intentRequestsAnalyticsScopes,
  intentRequestsBusinessManagement,
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

test("analytics scopes request ad analytics and pause controls, exclude publishing", () => {
  assert.deepEqual(
    [...SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES],
    ["ads_read", "ads_management", "business_management"],
  );
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
  assert.equal(intentRequestsAnalyticsScopes(["ads_read"]), false);
  assert.equal(
    intentRequestsAnalyticsScopes(["ads_read", "business_management"]),
    false,
  );
  assert.equal(
    intentRequestsAnalyticsScopes([
      "ads_read",
      "ads_management",
      "business_management",
    ]),
    true,
  );
  assert.equal(intentRequestsAdsRead(["ads_read"]), true);
  assert.equal(intentRequestsBusinessManagement(["business_management"]), true);
});

test("publication scopes retain publishing permissions and exclude ads_read", () => {
  assert.ok(SOCIAL_META_PUBLICATION_OAUTH_SCOPES.includes("pages_manage_posts"));
  assert.ok(SOCIAL_META_PUBLICATION_OAUTH_SCOPES.includes("instagram_content_publish"));
  assert.ok(SOCIAL_META_PUBLICATION_OAUTH_SCOPES.includes("business_management"));
  assert.equal(
    (SOCIAL_META_PUBLICATION_OAUTH_SCOPES as readonly string[]).includes("ads_read"),
    false,
  );
});

test("purpose helpers separate analytics and publication return paths", () => {
  assert.equal(
    resolveOAuthPurposeFromIntent({
      publicationTargetId: META_AD_ANALYTICS_OAUTH_TARGET_ID,
      scopes: ["ads_read", "ads_management", "business_management"],
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
  assert.doesNotMatch(route, /pages_manage_posts|instagram_content_publish/);
});

test("callback route clears purpose cookie and never forwards code/state", () => {
  const route = read("src/app/api/admin/social-oauth/callback/route.ts");
  assert.match(route, /purposeHint/);
  assert.match(route, /maxAge:\s*0/);
  assert.doesNotMatch(route, /searchParams\.set\("code"/);
  assert.doesNotMatch(route, /searchParams\.set\("state"/);
});

test("ad analytics page exposes permanent reconnect without raw scope copy", () => {
  const page = read("src/app/admin/ad-analytics/page.tsx");
  assert.match(page, /Reconnect Meta for Analytics/);
  assert.match(page, /\/api\/admin\/ad-analytics\/oauth\/connect/);
  assert.doesNotMatch(page, /ads_read<\/code> only/);
  assert.doesNotMatch(page, /business_management/);
  assert.doesNotMatch(page, /Publication execution → Meta OAuth/);
});

test("token resolver requires full analytics scope contract", () => {
  const resolver = read("src/lib/meta-ads/token-resolver.ts");
  assert.match(resolver, /intentRequestsAnalyticsScopes/);
  assert.match(resolver, /business_management/);
  assert.match(resolver, /ads_management/);
});
