import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getNextSpecialistReadiness } from "./specialist-readiness.ts";

test("Booking Agent is prepared as deterministic read-only triage", () => {
  const readiness = getNextSpecialistReadiness();

  assert.equal(readiness.agentKey, "booking");
  assert.equal(readiness.status, "READ-ONLY READY");
  assert.equal(readiness.activation, "OWNER-INITIATED ONLY");
  assert.equal(readiness.firstJobType, "booking.workflow.triage");
  assert.equal(readiness.handler, "Deterministic TypeScript");
  assert.equal(readiness.aiCalls, 0);
  assert.equal(readiness.wakeMode, "Event-driven only");
  assert.match(readiness.firstCheckpoint.join(" "), /redacted owner-facing triage summary/i);
});

test("Booking Agent readiness blocks every booking mutation and external side effect", async () => {
  const readiness = getNextSpecialistReadiness();
  const blocked = readiness.blockedActions.join(" ");
  const source = await readFile(new URL("specialist-readiness.ts", import.meta.url), "utf8");

  for (const required of ["confirm", "reject", "edit", "cancel", "messages", "calendar", "payment", "production", "credentials", "migrations", "paid services"]) {
    assert.match(blocked, new RegExp(required, "i"));
  }
  assert.doesNotMatch(source, /fetch\(|createServiceRoleClient|tasks\.trigger|openai|anthropic|model\.generate/i);
});
