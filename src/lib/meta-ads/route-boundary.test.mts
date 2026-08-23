import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

test("ad analytics page is owner-gated and force-dynamic", () => {
  const page = read("src/app/admin/ad-analytics/page.tsx");
  assert.match(page, /verifyAdminOwnerAccess/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(page, /accessToken|access_token|Bearer /);
  assert.doesNotMatch(page, /META_APP_SECRET|CREDENTIAL_VAULT_MASTER_KEY/);
});

test("ad analytics API is owner-gated and no-store", () => {
  const route = read("src/app/api/admin/ad-analytics/route.ts");
  assert.match(route, /verifyAdminOwnerAccess/);
  assert.match(route, /private, no-store/);
  assert.match(route, /resolveMetaAdsAccessToken/);
  assert.doesNotMatch(route, /Authorization/);
  assert.doesNotMatch(route, /rawProvider|encrypted_payload/);
});

test("meta-ads client keeps tokens server-side and limits writes to ad pause", () => {
  const http = read("src/lib/meta-ads/http-client.ts");
  const marketing = read("src/lib/meta-ads/marketing-api.ts");
  const config = read("src/lib/social-posts/oauth/social-oauth-config.ts");
  const purpose = read("src/lib/social-posts/oauth/social-oauth-purpose.ts");
  assert.match(http, /method: "GET"/);
  assert.match(http, /method: "POST"/);
  assert.match(marketing, /status:\s*"PAUSED"/);
  assert.doesNotMatch(marketing, /status:\s*"ACTIVE"/);
  assert.match(purpose, /"ads_read"/);
  assert.match(purpose, /"ads_management"/);
  assert.match(purpose, /"business_management"/);
  assert.match(config, /SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES/);
});

test("client dashboard component does not import token loader or vault", () => {
  const client = read("src/app/admin/ad-analytics/AdAnalyticsClient.tsx");
  assert.doesNotMatch(client, /token-loader|decryptOAuthSecret|vault/);
  assert.doesNotMatch(client, /graph\.facebook\.com/);
});

test("admin layout already sets noindex for all admin routes", () => {
  const layout = read("src/app/admin/layout.tsx");
  assert.match(layout, /index:\s*false/);
});
