import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SYNTHETIC_LAUNCH_TEST_ID,
  childGroupKey,
  drawEntriesFromGroups,
  excludeSyntheticNominations,
  groupNominationsByChild,
  projectPublicNomineeCards,
} from "./nomination-groups";

const baseline = [
  {
    id: "f710e5e3-f5e9-4939-a937-208edeee1b82",
    childName: "Colton",
    birthMonth: 9,
    birthDay: 26,
    partyChoice: "september_birthday",
    reason: "Story from Stephanie",
    nominatorName: "Stephanie Long",
    nominatorEmail: "stephlong843@gmail.com",
  },
  {
    id: "fa4a8750-a173-43b8-ae24-3670238f2a0c",
    childName: "Colton",
    birthMonth: 9,
    birthDay: 26,
    partyChoice: "september_birthday",
    reason: "Story from Candice",
    nominatorName: "Candice Morris",
    nominatorEmail: "caldwellsr38@gmail.com",
  },
  {
    id: "22412ba4-8611-48e3-ae07-bf2abb271f60",
    childName: "Kimber",
    birthMonth: 5,
    birthDay: 29,
    partyChoice: "back_to_school",
    reason: "Story from Karen",
    nominatorName: "Karen Eakin",
    nominatorEmail: "kegunter@hotmail.com",
  },
  {
    id: "c9c5830a-94b0-4b5e-9877-7e73feea7765",
    childName: "Kimber",
    birthMonth: 5,
    birthDay: 29,
    partyChoice: "back_to_school",
    reason: "Story from Justin",
    nominatorName: "Justin Eakin",
    nominatorEmail: "justin.mmasters@gmail.com",
  },
  {
    id: "0f19b6ec-d04e-44ed-82a8-51e0d39dc207",
    childName: "Zendaya M.",
    birthMonth: 7,
    birthDay: 12,
    partyChoice: "back_to_school",
    reason: "Story from Shakina",
    nominatorName: "Shakina McDuffie",
    nominatorEmail: "moniqueh1989@gmail.com",
  },
];

test("exact grouping collapses duplicate children and keeps distinct submissions", () => {
  const groups = groupNominationsByChild(baseline);
  assert.equal(groups.length, 3);

  const colton = groups.find((group) => group.childName === "Colton");
  const kimber = groups.find((group) => group.childName === "Kimber");
  assert.ok(colton);
  assert.ok(kimber);
  assert.equal(colton.nominationCount, 2);
  assert.equal(kimber.nominationCount, 2);
  assert.equal(colton.submissions.length, 2);
  assert.equal(kimber.submissions.length, 2);
  assert.equal(
    childGroupKey("  Colton ", 9, 26),
    childGroupKey("Colton", 9, 26),
  );
  assert.equal(
    childGroupKey("Andrea O.", 1, 20),
    childGroupKey("Andrea O", 1, 20),
  );
});

test("draw uses one entry per unique child, not per submission", () => {
  const groups = groupNominationsByChild(baseline);
  const draw = drawEntriesFromGroups(groups);
  assert.equal(draw.length, 3);
  assert.equal(draw.filter((entry) => entry.childName === "Colton").length, 1);
  assert.equal(draw.filter((entry) => entry.childName === "Kimber").length, 1);
});

test("public projection omits private fields and counts unique children", () => {
  const cards = projectPublicNomineeCards(groupNominationsByChild(baseline));
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.equal("birthMonth" in card, false);
    assert.equal("reason" in card, false);
    assert.equal("nominatorName" in card, false);
    assert.equal("nominatorEmail" in card, false);
    assert.equal("id" in card, false);
    assert.ok(card.groupKey);
    assert.ok(card.childName);
    assert.ok(card.partyChoice);
  }
});

test("synthetic launch test UUID is excluded", () => {
  const mixed = [
    ...baseline,
    {
      id: SYNTHETIC_LAUNCH_TEST_ID,
      childName: "Testchild L.",
      birthMonth: 1,
      birthDay: 1,
      partyChoice: "back_to_school",
      reason: "synthetic",
      nominatorName: "Launch Verification Bot",
    },
  ];
  const filtered = excludeSyntheticNominations(mixed);
  assert.equal(filtered.length, baseline.length);
  assert.equal(
    filtered.some((row) => row.id === SYNTHETIC_LAUNCH_TEST_ID),
    false,
  );
});

test("admin and public pages load grouped nominations helpers", () => {
  const adminPage = readFileSync(
    new URL("../../app/admin/giveaway/page.tsx", import.meta.url),
    "utf8",
  );
  const adminClient = readFileSync(
    new URL("../../app/admin/giveaway/GiveawayDrawClient.tsx", import.meta.url),
    "utf8",
  );
  const publicPage = readFileSync(
    new URL("../../app/nominees/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(adminPage, /groupNominationsByChild/);
  assert.match(adminClient, /nominationCount/);
  assert.match(publicPage, /groupNominationsByChild|projectPublicNomineeCards/);
  assert.doesNotMatch(publicPage, /nomination_reason|nominator_email|nominator_name/);
});
