import assert from "node:assert/strict";
import test from "node:test";

import { INVITATION_PREVIEW_EXAMPLES, snapshotForExample } from "./examples.ts";
import {
  listInvitationOptions,
  matchInvitationTheme,
  MAX_INVITATION_ALTERNATE_LOADS,
} from "./match-theme.ts";
import {
  advanceInvitationSnapshot,
  buildInvitationSnapshot,
  invitationSnapshotFromChoice,
} from "./snapshot.ts";

test("common kid themes map to stable theme IDs", () => {
  assert.equal(matchInvitationTheme("Sonic").themeId, "sonic");
  assert.equal(matchInvitationTheme("Mario").themeId, "mario");
  assert.equal(matchInvitationTheme("Minecraft").themeId, "minecraft");
  assert.equal(matchInvitationTheme("Pokémon").themeId, "pokemon");
  assert.equal(matchInvitationTheme("Barbie").themeId, "barbie");
  assert.equal(matchInvitationTheme("Paw Patrol").themeId, "paw-patrol");
  assert.equal(matchInvitationTheme("Bluey").themeId, "bluey");
  assert.equal(matchInvitationTheme("Spider-Man").themeId, "spider-man");
  assert.equal(matchInvitationTheme("Batman").themeId, "batman");
  assert.equal(matchInvitationTheme("princess").themeId, "princess");
  assert.equal(matchInvitationTheme("mermaid").themeId, "mermaid");
  assert.equal(matchInvitationTheme("unicorn").themeId, "unicorn");
  assert.equal(matchInvitationTheme("dinosaurs").themeId, "dinosaurs");
  assert.equal(matchInvitationTheme("Clemson").themeId, "clemson");
  assert.equal(matchInvitationTheme("Gamecocks").themeId, "gamecocks");
});

test("casual wording and misspellings still match", () => {
  assert.equal(matchInvitationTheme("sonic party").themeId, "sonic");
  assert.equal(matchInvitationTheme("mine craft").themeId, "minecraft");
  assert.equal(matchInvitationTheme("paw patrol theme").themeId, "paw-patrol");
  assert.equal(matchInvitationTheme("spiderman").themeId, "spider-man");
  assert.equal(matchInvitationTheme("gamecock football").themeId, "gamecocks");
  assert.equal(matchInvitationTheme("sonnic").themeId, "sonic");
  assert.equal(matchInvitationTheme("minecraf").themeId, "minecraft");
});

test("unknown themes fall back to a generic family style", () => {
  const unknown = matchInvitationTheme("Nana's backyard picnic");
  assert.equal(unknown.themeId, "generic-birthday");
  assert.equal(unknown.styleFamily, "birthday");
  assert.equal(unknown.matchKind, "fallback");

  const colorful = matchInvitationTheme("sparkle galaxy slime lab");
  assert.equal(colorful.themeId, "generic-colorful");
  assert.equal(colorful.styleFamily, "colorful");

  const football = matchInvitationTheme("football team");
  assert.equal(football.themeId, "generic-sports");
  assert.equal(football.styleFamily, "sports");

  const empty = matchInvitationTheme("   ");
  assert.equal(empty.themeId, "generic-birthday");
});

test("example previews pick the expected artwork slot", () => {
  for (const example of INVITATION_PREVIEW_EXAMPLES) {
    const snapshot = snapshotForExample(example);
    assert.equal(snapshot.themeId, example.expectedThemeId, example.id);
    assert.equal(snapshot.styleFamily, example.expectedFamily, example.id);
    assert.equal(snapshot.artworkSlot, example.expectedThemeId, example.id);
  }
});

test("snapshots keep the original customer theme text", () => {
  const snapshot = buildInvitationSnapshot("  Paw Patrol theme  ");
  assert.equal(snapshot.sourceText, "Paw Patrol theme");
  assert.equal(snapshot.themeId, "paw-patrol");
  assert.equal(snapshot.artworkKind, "inspired");
  assert.equal(snapshot.optionIndex, 0);
  assert.equal(snapshot.alternatesUsed, 0);
  assert.equal(snapshot.alternatesLocked, false);
});

test("first match is option index 0", () => {
  const snapshot = invitationSnapshotFromChoice("sonic party", 0, 0);
  assert.equal(snapshot.themeId, "sonic");
  assert.equal(snapshot.optionIndex, 0);
  const options = listInvitationOptions("sonic party");
  assert.equal(options.length, MAX_INVITATION_ALTERNATE_LOADS + 1);
  assert.equal(options[0]?.themeId, "sonic");
});

test("loading alternatives is capped at three and a fourth load is blocked", () => {
  let snapshot = buildInvitationSnapshot("Minecraft");
  assert.equal(snapshot.themeId, "minecraft");
  const seen = new Set([`${snapshot.themeId}:${snapshot.artworkVariant}`]);

  snapshot = advanceInvitationSnapshot(snapshot);
  seen.add(`${snapshot.themeId}:${snapshot.artworkVariant}`);
  assert.equal(snapshot.alternatesUsed, 1);
  assert.equal(snapshot.optionIndex, 1);
  assert.equal(snapshot.alternatesLocked, false);
  assert.equal(snapshot.styleFamily, "gamer");

  snapshot = advanceInvitationSnapshot(snapshot);
  seen.add(`${snapshot.themeId}:${snapshot.artworkVariant}`);
  assert.equal(snapshot.alternatesUsed, 2);
  assert.equal(snapshot.optionIndex, 2);

  snapshot = advanceInvitationSnapshot(snapshot);
  seen.add(`${snapshot.themeId}:${snapshot.artworkVariant}`);
  assert.equal(snapshot.alternatesUsed, 3);
  assert.equal(snapshot.optionIndex, 3);
  assert.equal(snapshot.alternatesLocked, true);
  assert.equal(seen.size >= 2, true);

  const locked = { ...snapshot };
  snapshot = advanceInvitationSnapshot(snapshot);
  assert.equal(snapshot.themeId, locked.themeId);
  assert.equal(snapshot.artworkVariant, locked.artworkVariant);
  assert.equal(snapshot.optionIndex, locked.optionIndex);
  assert.equal(snapshot.alternatesUsed, 3);
  assert.equal(snapshot.alternatesLocked, true);
});

test("changing the typed theme rematches and resets alternate tries", () => {
  let snapshot = buildInvitationSnapshot("sonic party");
  snapshot = advanceInvitationSnapshot(snapshot);
  snapshot = advanceInvitationSnapshot(snapshot);
  assert.equal(snapshot.alternatesUsed, 2);
  assert.notEqual(snapshot.optionIndex, 0);

  snapshot = buildInvitationSnapshot("paw patrol theme");
  assert.equal(snapshot.themeId, "paw-patrol");
  assert.equal(snapshot.optionIndex, 0);
  assert.equal(snapshot.alternatesUsed, 0);
  assert.equal(snapshot.alternatesLocked, false);
});
