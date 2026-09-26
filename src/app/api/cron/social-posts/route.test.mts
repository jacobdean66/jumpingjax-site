import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "route.ts"), "utf8");

test("scheduled Social Posts worker requires CRON_SECRET and the protected runner", () => {
  assert.match(source, /CRON_SECRET/);
  assert.match(source, /Bearer/);
  assert.match(source, /runDueMetaOrganicPublications/);
  assert.doesNotMatch(source, /verifyAdminAccess|verifyAdminOwnerAccess/);
});
