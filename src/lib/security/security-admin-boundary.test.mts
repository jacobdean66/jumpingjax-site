import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("security page and every endpoint are owner gated", () => {
  const files = [
    "src/app/admin/security/page.tsx",
    "src/app/api/admin/security/status/route.ts",
    "src/app/api/admin/security/scan/route.ts",
    "src/app/api/admin/security/scan-status/route.ts",
    "src/app/api/admin/security/health/route.ts",
  ];
  for (const file of files) assert.match(read(file), /verifyAdminOwnerAccess/);
});

test("security responses are private and excluded from indexing", () => {
  const guard = read("src/lib/security/request-guard.ts");
  assert.match(guard, /private, no-store/);
  assert.match(guard, /noindex, nofollow, noarchive/);
});

test("write endpoints require same-origin JSON", () => {
  const guard = read("src/lib/security/request-guard.ts");
  for (const route of ["scan", "scan-status", "health"]) {
    const source = read(`src/app/api/admin/security/${route}/route.ts`);
    assert.match(source, /validateOwnerPost\(request\)/);
    assert.match(source, /rateLimit\(request/);
  }
  assert.match(guard, /application\/json/);
  assert.match(guard, /originUrl\.origin !== requestUrl\.origin/);
});

test("client receives normalized data and no provider secrets", () => {
  const client = read("src/app/admin/security/SecurityDashboardClient.tsx");
  assert.doesNotMatch(client, /process\.env|AIKIDO_CI_SECRET|AITHURA_API_KEY|OPENAI_API_KEY|Authorization|X-AIK-API-SECRET/);
  assert.doesNotMatch(client, /dangerouslySetInnerHTML/);
});

test("provider endpoints are fixed and redirects are rejected", () => {
  const aikido = read("src/lib/security/aikido-client.ts");
  const protectedConfig = read("src/lib/security/protected-openai-config.ts");
  assert.match(aikido, /const AIKIDO_ORIGIN = "https:\/\/app\.aikido\.dev"/);
  assert.match(aikido, /redirect: "error"/);
  assert.match(protectedConfig, /APPROVED_ROUTES/);
  assert.doesNotMatch(protectedConfig, /NEXT_PUBLIC_/);
});

test("repair control cannot mutate, merge, or deploy", () => {
  const client = read("src/app/admin/security/SecurityDashboardClient.tsx");
  const apiFiles = ["status", "scan", "health"];
  assert.match(client, /Repairs begin from the recorded finding/);
  assert.match(client, /actionUrl/);
  assert.equal(apiFiles.some((name) => /fix|merge|deploy/.test(name)), false);
  assert.doesNotMatch(client, /\/api\/admin\/security\/(fix|merge|deploy)/);
});

test("dashboard reports deployment identity, application controls, and recorded findings", () => {
  const service = read("src/lib/security/dashboard-service.ts");
  const client = read("src/app/admin/security/SecurityDashboardClient.tsx");
  assert.match(service, /getApplicationSecurityChecks/);
  assert.match(service, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(service, /effectiveLatestScan\.detailsUrl/);
  assert.match(client, /Application security controls/);
  assert.match(client, /Production findings/);
  assert.doesNotMatch(service, /repositories\/2828507/);
});

test("latest scan status is scoped to the current deployment, not one owner", () => {
  const store = read("src/lib/security/action-store.ts");
  assert.match(store, /export async function loadLatestAikidoScan\(\)/);
  assert.match(store, /\.eq\("deployment_sha", deploymentSha\)/);
});

test("security navigation is owner-only", () => {
  const nav = read("src/app/admin/_components.tsx");
  const home = read("src/app/admin/page.tsx");
  assert.match(nav, /id: "security"/);
  assert.match(nav, /role === "owner"/);
  assert.match(home, /Security Center/);
});
