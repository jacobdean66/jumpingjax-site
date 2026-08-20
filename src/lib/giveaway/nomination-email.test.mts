import assert from "node:assert/strict";
import test from "node:test";

import { parseNominationEmail } from "./nomination-email.ts";
import { listFixtureState, saveFixtureNomination, type NominationFixtureState } from "./nomination-fixture-store.ts";

function fixture(sourceEventId: string) {
  return {
    sourceEventId,
    from: "fixture.sender@example.test",
    subject: "Free Party Nomination: Avery J.",
    text: [
      "A new Jumping Jax Free Party Giveaway nomination was submitted.",
      "",
      "Nominator: Fixture Parent",
      "Nominator email: fixture.parent@example.test",
      "Child: Avery Jones",
      "Birthday: 09/14",
      "Party choice: September birthday party",
      "",
      "Why this child was nominated:",
      "This is a deterministic test nomination with no model call.",
      "",
      "Submitted: Thursday, August 20, 2026 at 1:30 PM EDT",
      `Nomination ID: ${sourceEventId}`,
    ].join("\n"),
  };
}

test("structured nomination email is parsed deterministically into the existing schema", () => {
  const row = parseNominationEmail(fixture("jj-fixture-parser"));
  assert.equal(row.idempotency_key, "email:jj-fixture-parser");
  assert.equal(row.child_name, "Avery J.");
  assert.equal(row.child_birth_month, 9);
  assert.equal(row.child_birth_day, 14);
  assert.equal(row.party_choice, "september_birthday");
  assert.equal(row.nominator_email, "fixture.parent@example.test");
});

test("the same source event is stored once while separate nominations remain valid business rows", async () => {
  const source = `jj-fixture-dedupe-${Date.now()}`;
  const row = parseNominationEmail(fixture(source));
  const state: NominationFixtureState = new Map();
  const first = saveFixtureNomination(state, row);
  const second = saveFixtureNomination(state, row);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  assert.equal(listFixtureState(state).length, 1);
});

test("unstructured or unrelated email fails closed without AI fallback", () => {
  assert.throws(() => parseNominationEmail({ sourceEventId: "jj-fixture-invalid", from: "sender@example.test", subject: "Hello", text: "No nomination fields" }), /not a nomination event/);
});
