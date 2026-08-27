import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatPublicChildDisplayName,
  pickSecureRandomIndex,
} from "./public-nominee-display";

test("public display names keep only first name and last initial", () => {
  assert.equal(formatPublicChildDisplayName("Avery J."), "Avery J.");
  assert.equal(formatPublicChildDisplayName("Avery Jordan"), "Avery J.");
  assert.equal(formatPublicChildDisplayName("  sam   lee  "), "sam L.");
  assert.equal(formatPublicChildDisplayName("Taylor"), "Taylor");
});

test("secure random index stays within equal-odds range", () => {
  for (let i = 0; i < 40; i += 1) {
    const index = pickSecureRandomIndex(7);
    assert.ok(index >= 0 && index < 7);
  }
  assert.throws(() => pickSecureRandomIndex(0));
});

test("public nominees page never selects private nomination fields", () => {
  const page = readFileSync(
    new URL("../../app/nominees/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /robots:\s*\{\s*index:\s*false/);
  assert.match(page, /select\("id, child_name, party_choice, child_birth_month, child_birth_day"\)/);
  assert.match(page, /formatPublicChildDisplayName/);
  assert.match(page, /projectPublicNomineeCards|groupNominationsByChild/);
  assert.doesNotMatch(page, /nomination_reason|nominator_email|nominator_name/);
});

test("admin giveaway draw stays owner-authenticated and client-side only", () => {
  const page = readFileSync(
    new URL("../../app/admin/giveaway/page.tsx", import.meta.url),
    "utf8",
  );
  const client = readFileSync(
    new URL("../../app/admin/giveaway/GiveawayDrawClient.tsx", import.meta.url),
    "utf8",
  );
  const home = readFileSync(
    new URL("../../app/admin/page.tsx", import.meta.url),
    "utf8",
  );
  const nav = readFileSync(
    new URL("../../app/admin/_components.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /verifyAdminOwnerAccess/);
  assert.match(client, /pickSecureRandomIndex|secureRandomIndex|crypto\.getRandomValues/);
  assert.match(client, /does not publish or save a winner/i);
  assert.match(nav, /role === "owner"[\s\S]*Giveaway Draw/);
  assert.match(home, /auth\.role === "owner"/);
  assert.match(home, /Giveaway Draw/);
});
