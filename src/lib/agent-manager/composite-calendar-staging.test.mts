import assert from "node:assert/strict";
import test from "node:test";

import { buildStagedCompositeBookingIntent } from "./composite-booking-intent";
import {
  rollbackCalendarProjectionStaging,
  stageApprovedCalendarProjections,
} from "./composite-calendar-staging";

function intent() {
  const result = buildStagedCompositeBookingIntent({
    conversationRef: "calendar-stage-proof",
    revision: 1,
    services: [{
      kind: "facility_party",
      date: "2026-11-07",
      startMinutes: 720,
      durationMinutes: 120,
      packageRef: "whole-facility",
    }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("proof intent should be ready");
  return result.intent;
}

test("calendar staging requires explicit owner approval and performs no external write", () => {
  const blocked = stageApprovedCalendarProjections({ intent: intent(), ownerDecision: "pending" });
  assert.deepEqual(blocked, { ok: false, status: "approval_required", conflicts: [] });
  const staged = stageApprovedCalendarProjections({ intent: intent(), ownerDecision: "approved" });
  assert.equal(staged.ok, true);
  if (!staged.ok) return;
  assert.equal(staged.projections.length, 1);
  assert.equal(staged.projections[0].status, "staged");
  assert.equal(staged.projections[0].externalEventRef, null);
});

test("staging is idempotent and blocks a cross-intent resource overlap", () => {
  const first = stageApprovedCalendarProjections({ intent: intent(), ownerDecision: "approved" });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const replay = stageApprovedCalendarProjections({
    intent: intent(),
    ownerDecision: "approved",
    existing: first.projections,
  });
  assert.equal(replay.ok && replay.replayed, true);

  const other = { ...intent(), transactionKey: "composite-booking:other" };
  const conflict = stageApprovedCalendarProjections({
    intent: other,
    ownerDecision: "approved",
    existing: first.projections,
  });
  assert.deepEqual(conflict, { ok: false, status: "conflict", conflicts: ["facility:main"] });
});

test("staged projections roll back without deletion but projected events fail closed", () => {
  const staged = stageApprovedCalendarProjections({ intent: intent(), ownerDecision: "approved" });
  assert.equal(staged.ok, true);
  if (!staged.ok) return;
  const rolledBack = rollbackCalendarProjectionStaging(staged.projections);
  assert.equal(rolledBack.ok, true);
  assert.equal(rolledBack.records.every(({ status }) => status === "rolled_back"), true);

  const projected = [{ ...staged.projections[0], status: "projected" as const, externalEventRef: "calendar-event" }];
  assert.equal(rollbackCalendarProjectionStaging(projected).ok, false);
});

