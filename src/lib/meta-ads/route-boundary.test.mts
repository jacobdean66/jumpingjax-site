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
  assert.doesNotMatch(route, /accessToken|Authorization/);
  assert.doesNotMatch(route, /rawProvider|encrypted_payload/);
});

test("meta-ads client never uses ads_management and stays read-only GET", () => {
  const http = read("src/lib/meta-ads/http-client.ts");
  const marketing = read("src/lib/meta-ads/marketing-api.ts");
  const config = read("src/lib/social-posts/oauth/social-oauth-config.ts");
  assert.match(http, /method: "GET"/);
  assert.doesNotMatch(http, /method: "POST"/);
  assert.doesNotMatch(marketing, /ads_management/);
  assert.match(config, /"ads_read"/);
  assert.doesNotMatch(config, /ads_management/);
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
