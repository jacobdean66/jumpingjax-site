import assert from "node:assert/strict";
import test from "node:test";

import {
  INVITATION_AGENT_ACTIONS,
  INVITATION_AGENT_STANDARD,
  runInvitationAgent,
} from "./agent.ts";

test("approved invitation standard stays attached to the customer-requested theme", () => {
  assert.deepEqual(INVITATION_AGENT_STANDARD, {
    version: "light-ink-full-page-borderless-v3",
    themeSource: "customer-party-theme",
    defaultPrintPaper: "letter",
    exactFourBySixPaper: "legal",
    cardsPerSheet: 4,
    inkSaver: true,
    printSafeMarginInches: 0,
    showCutLines: false,
  });
});

test("invitation specialist has all three asset libraries attached", () => {
  const result = runInvitationAgent({
    action: "create",
    sourceText: "Curious George",
  });

  assert.deepEqual(
    result.attachedLibraries.map((library) => library.id),
    ["approved-artwork", "fluent-emoji", "kenney-cc0"],
  );
  assert.equal(result.agent, "party-invitation");
  assert.equal(result.status, "completed");
});

test("Curious George safely selects the jungle animal composition instead of birthday fallback", () => {
  const result = runInvitationAgent({
    action: "create",
    sourceText: "Curious George",
  });

  assert.equal(result.snapshot.themeId, "safari-animals");
  assert.equal(result.snapshot.matchKind, "exact");
  assert.deepEqual(result.usedLibraries, ["fluent-emoji", "kenney-cc0"]);
});

test("alternate invitation actions advance one stable design", () => {
  const result = runInvitationAgent({
    action: "alternate",
    sourceText: "Curious George",
    optionIndex: 0,
    alternatesUsed: 0,
  });

  assert.equal(result.snapshot.optionIndex, 1);
  assert.equal(result.snapshot.alternatesUsed, 1);
  assert.equal(result.snapshot.themeId, "safari-animals");
});

test("specialist action contract covers every invitation button family", () => {
  assert.deepEqual(INVITATION_AGENT_ACTIONS, [
    "create",
    "alternate",
    "choose-delivery",
    "choose-template",
    "open",
    "view-single",
    "view-sheet",
    "email",
    "print",
  ]);
});
