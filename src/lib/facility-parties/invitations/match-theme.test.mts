import assert from "node:assert/strict";
import test from "node:test";

import { approvedArtworkSrc } from "./approved-artwork.ts";
import { INVITATION_PREVIEW_EXAMPLES, snapshotForExample, sonicSampleSnapshot } from "./examples.ts";
import { composeLibraryInvitation } from "./library/compose.ts";
import { INVITATION_LIBRARY_THEMES } from "./library/themes.ts";
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

test("approved library themes map from customer wording", () => {
  assert.equal(matchInvitationTheme("Sonic").themeId, "gamer-neon");
  assert.equal(matchInvitationTheme("Mario").themeId, "gamer-neon");
  assert.equal(matchInvitationTheme("Minecraft").themeId, "gamer-neon");
  assert.equal(matchInvitationTheme("Pokémon").themeId, "safari-animals");
  assert.equal(matchInvitationTheme("Barbie").themeId, "princess-royal");
  assert.equal(matchInvitationTheme("Paw Patrol").themeId, "safari-animals");
  assert.equal(matchInvitationTheme("Bluey").themeId, "safari-animals");
  assert.equal(matchInvitationTheme("Spider-Man").themeId, "gamer-neon");
  assert.equal(matchInvitationTheme("Frozen").themeId, "princess-royal");
  assert.equal(matchInvitationTheme("princess").themeId, "princess-royal");
  assert.equal(matchInvitationTheme("mermaid").themeId, "ocean-mermaid");
  assert.equal(matchInvitationTheme("unicorn").themeId, "unicorn-rainbow");
  assert.equal(matchInvitationTheme("dinosaurs").themeId, "dinosaur");
  assert.equal(matchInvitationTheme("Clemson").themeId, "sports");
  assert.equal(matchInvitationTheme("space").themeId, "space");
});

test("casual wording and misspellings still match", () => {
  assert.equal(matchInvitationTheme("sonic party").themeId, "gamer-neon");
  assert.equal(matchInvitationTheme("mine craft").themeId, "gamer-neon");
  assert.equal(matchInvitationTheme("paw patrol theme").themeId, "safari-animals");
  assert.equal(matchInvitationTheme("spiderman").themeId, "gamer-neon");
  assert.equal(matchInvitationTheme("sonnic").themeId, "gamer-neon");
});

test("unknown themes fall back to classic birthday", () => {
  const unknown = matchInvitationTheme("Nana's backyard picnic");
  assert.equal(unknown.themeId, "classic-birthday");
  assert.equal(unknown.styleFamily, "birthday");
  assert.equal(unknown.matchKind, "fallback");

  const colorful = matchInvitationTheme("sparkle galaxy slime lab");
  assert.equal(colorful.themeId, "unicorn-rainbow");
  assert.equal(colorful.styleFamily, "colorful");

  const football = matchInvitationTheme("football team");
  assert.equal(football.themeId, "sports");
  assert.equal(football.styleFamily, "sports");

  const empty = matchInvitationTheme("   ");
  assert.equal(empty.themeId, "classic-birthday");
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
  assert.equal(snapshot.themeId, "safari-animals");
  assert.equal(snapshot.artworkKind, "approved");
  assert.equal(snapshot.optionIndex, 0);
  assert.equal(snapshot.alternatesUsed, 0);
  assert.equal(snapshot.alternatesLocked, false);
});

test("library assets are local and used for recognized themes", () => {
  const match = matchInvitationTheme("sonic party");
  assert.equal(match.themeId, "gamer-neon");
  assert.equal(match.artworkKind, "approved");
  const src = approvedArtworkSrc("gamer-neon");
  assert.equal(src?.startsWith("/invitation-library/"), true);
  const sample = sonicSampleSnapshot();
  assert.equal(sample.themeId, "gamer-neon");
  assert.equal(sample.sourceText, "Sonic");
});

test("each library theme composes a hero, decorations, palette, and layout", () => {
  assert.equal(INVITATION_LIBRARY_THEMES.length, 12);
  for (const theme of INVITATION_LIBRARY_THEMES) {
    assert.ok(theme.heroes.length >= 1 && theme.heroes.length <= 3, theme.id);
    assert.ok(theme.decorations.length >= 3, theme.id);
    assert.ok(theme.palettes.length >= 1 && theme.palettes.length <= 3, theme.id);
    assert.ok(theme.layouts.length >= 2, theme.id);
    const composed = composeLibraryInvitation({ themeId: theme.id, optionIndex: 0 });
    assert.equal(composed.hero.src.startsWith("/invitation-library/"), true, theme.id);
    assert.ok(composed.decorations.length >= 1, theme.id);
  }
});

test("regeneration stays on the same theme and stays non-empty", () => {
  const snapshot = invitationSnapshotFromChoice("dinosaur party", 0, 0);
  assert.equal(snapshot.themeId, "dinosaur");
  const options = listInvitationOptions("dinosaur party");
  assert.equal(options.length, MAX_INVITATION_ALTERNATE_LOADS + 1);
  for (const option of options) {
    assert.equal(option.themeId, "dinosaur");
    const composed = composeLibraryInvitation({
      themeId: option.themeId,
      optionIndex: option.artworkVariant,
    });
    assert.ok(composed.hero.src);
  }
});

test("loading alternatives is capped at three and a fourth load is blocked", () => {
  let snapshot = buildInvitationSnapshot("Minecraft");
  assert.equal(snapshot.themeId, "gamer-neon");
  snapshot = advanceInvitationSnapshot(snapshot);
  assert.equal(snapshot.alternatesUsed, 1);
  assert.equal(snapshot.themeId, "gamer-neon");
  snapshot = advanceInvitationSnapshot(snapshot);
  assert.equal(snapshot.alternatesUsed, 2);
  snapshot = advanceInvitationSnapshot(snapshot);
  assert.equal(snapshot.alternatesUsed, 3);
  assert.equal(snapshot.alternatesLocked, true);
  const locked = { ...snapshot };
  snapshot = advanceInvitationSnapshot(snapshot);
  assert.equal(snapshot.themeId, locked.themeId);
  assert.equal(snapshot.optionIndex, locked.optionIndex);
  assert.equal(snapshot.alternatesUsed, 3);
});

test("changing the typed theme rematches and resets alternate tries", () => {
  let snapshot = buildInvitationSnapshot("sonic party");
  snapshot = advanceInvitationSnapshot(snapshot);
  snapshot = advanceInvitationSnapshot(snapshot);
  snapshot = buildInvitationSnapshot("paw patrol theme");
  assert.equal(snapshot.themeId, "safari-animals");
  assert.equal(snapshot.optionIndex, 0);
  assert.equal(snapshot.alternatesUsed, 0);
});
