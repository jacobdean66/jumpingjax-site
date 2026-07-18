import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = fileURLToPath(new URL(".", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, `file://${here}`), "utf8");
}

test("deliveries page and API require the canonical owner session", () => {
  const page = read("../../app/admin/deliveries/page.tsx");
  const route = read("../../app/api/admin/deliveries/route.ts");
  const session = read("./session.ts");

  assert.match(page, /verifyAdminOwnerAccess\(\)/);
  assert.equal((route.match(/verifyAdminOwnerAccess\(\)/g) ?? []).length, 2);
  assert.match(session, /auth\.role === "owner"/);
  assert.match(page, /href="\/admin"/);
  assert.match(page, />\s*Sign in\s*</);
  assert.doesNotMatch(`${page}\n${route}`, /verifyAdminDeliveryToken/);
  assert.doesNotMatch(`${page}\n${route}`, /searchParams\.get\("token"\)|body\?\.token/);
});

test("deliveries navigation and writes do not put credentials in URLs or bodies", () => {
  const page = read("../../app/admin/deliveries/page.tsx");
  const client = read("../../app/admin/deliveries/DeliveryPlannerClient.tsx");
  const rentals = read("../../app/admin/rentals/page.tsx");
  const logistics = read("../../app/logistics/page.tsx");

  assert.doesNotMatch(`${page}\n${rentals}`, /\/admin\/deliveries\?token=/);
  assert.doesNotMatch(client, /JSON\.stringify\(\{\s*token/);
  assert.match(logistics, /verifyAdminOwnerAccess\(\)/);
  assert.doesNotMatch(logistics, /ADMIN_DELIVERIES_TOKEN|token=/);
});
