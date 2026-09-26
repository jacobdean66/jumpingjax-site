import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "route.ts"), "utf8");

test("Meta scheduling is owner-only and forbids agent invocation", () => {
  assert.match(source, /verifyAdminOwnerAccess/);
  assert.match(source, /agent_schedule_forbidden/);
  assert.match(source, /x-social-agent|x-cursor-agent/);
  assert.match(source, /scheduleMetaOrganicPublication/);
});
