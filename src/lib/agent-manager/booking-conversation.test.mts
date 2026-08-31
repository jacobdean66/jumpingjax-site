import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceBookingConversation,
  createBookingConversation,
  type BookingConversationState,
  type BookingConversationTurn,
} from "./booking-conversation.ts";

function play(state: BookingConversationState, turns: BookingConversationTurn[]) {
  return turns.reduce((result, turn) => advanceBookingConversation(result.state, turn), {
    state,
    plan: null,
    evaluation: null,
    nextPrompt: null,
  } as unknown as ReturnType<typeof advanceBookingConversation>);
}

const completeTurns: BookingConversationTurn[] = [
  { type: "select_services", services: ["rental", "facility_party", "foam_party"] },
  { type: "set_schedule", service: "rental", date: "2026-09-19", startMinutes: 720, durationMinutes: 240 },
  { type: "set_rental_items", itemRefs: ["18-ft-basic-waterslide"] },
  { type: "set_location", service: "rental", locationRef: "location-token" },
  { type: "set_distance", service: "rental", distanceMiles: 12 },
  { type: "set_schedule", service: "facility_party", date: "2026-09-19", startMinutes: 780, durationMinutes: 120 },
  { type: "set_facility_package", packageRef: "whole-facility-2h" },
  { type: "set_schedule", service: "foam_party", date: "2026-09-19", startMinutes: 840, durationMinutes: 60 },
  { type: "set_location", service: "foam_party", locationRef: "location-token" },
  { type: "set_distance", service: "foam_party", distanceMiles: 12 },
];

test("guides a provider-neutral conversation from service choice to owner review", () => {
  const start = createBookingConversation("simulated-call-1");
  const selected = advanceBookingConversation(start, completeTurns[0]);
  assert.equal(selected.nextPrompt?.key, "date");
  assert.equal(selected.nextPrompt?.service, "rental");

  const completed = play(start, completeTurns);
  assert.equal(completed.plan.status, "ready_for_approval");
  assert.equal(completed.nextPrompt?.key, "owner_approval");
  assert.equal(completed.plan.writesAllowed, false);
  assert.equal(completed.plan.projections.length, 3);
  assert.equal(completed.evaluation.quote.totalCents, 92285);
  assert.equal(completed.evaluation.approvalIntent?.writesAllowed, false);
});

test("a spoken correction replaces the schedule and changes the dry-run identity", () => {
  const completed = play(createBookingConversation("simulated-call-2"), completeTurns);
  const corrected = advanceBookingConversation(completed.state, {
    type: "set_schedule",
    service: "foam_party",
    date: "2026-09-20",
    startMinutes: 900,
    durationMinutes: 120,
  });
  assert.notEqual(corrected.plan.transactionKey, completed.plan.transactionKey);
  assert.equal(corrected.plan.status, "ready_for_approval");
  assert.equal(corrected.plan.projections.find(({ service }) => service === "foam_party")?.date, "2026-09-20");
});

test("removing a service removes its calendar projection without affecting the others", () => {
  const completed = play(createBookingConversation("simulated-call-3"), completeTurns);
  const changed = advanceBookingConversation(completed.state, { type: "remove_service", service: "facility_party" });
  assert.equal(changed.plan.status, "ready_for_approval");
  assert.deepEqual(changed.plan.projections.map(({ service }) => service), ["rental", "foam_party"]);
});

test("cancellation ends the conversation with no booking or calendar work", () => {
  const completed = play(createBookingConversation("simulated-call-4"), completeTurns);
  const cancelled = advanceBookingConversation(completed.state, { type: "cancel" });
  assert.equal(cancelled.plan.status, "cancelled");
  assert.equal(cancelled.nextPrompt, null);
  assert.deepEqual(cancelled.plan.projections, []);
  assert.equal(cancelled.plan.writesAllowed, false);
});

test("a selection missing catalog pricing stops before owner approval", () => {
  const completed = play(createBookingConversation("simulated-call-5"), completeTurns);
  const unpriced = advanceBookingConversation(completed.state, {
    type: "set_rental_items",
    itemRefs: ["unknown-rental"],
  });
  assert.equal(unpriced.evaluation.status, "needs_pricing");
  assert.equal(unpriced.evaluation.approvalIntent, null);
  assert.equal(unpriced.nextPrompt?.key, "pricing_review");
});
