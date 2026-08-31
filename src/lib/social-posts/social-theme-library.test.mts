import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSocialThemeLibraryContext,
  socialThemePreferredSourceUrl,
} from "./social-theme-library";

test("Sonic reuses the Invitation Agent theme libraries and approved artwork", () => {
  const context = resolveSocialThemeLibraryContext("Sonic");
  assert.ok(context);
  assert.equal(context.themeId, "gamer-neon");
  assert.equal(context.matchedAlias, "sonic");
  assert.equal(context.approvedArtworkPath, "/invitations/approved/sonic/card.png");
  assert.deepEqual(context.attachedLibraries, ["fluent-emoji", "kenney-cc0"]);
  assert.equal(context.palette.background, "#0647b8");
  assert.match(context.promptContext, /do not imply endorsement/i);
});

test("preferred social source resolves to the shared approved theme artwork", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://jumpingjaxllc.com/";
  try {
    const context = resolveSocialThemeLibraryContext("sonic party");
    assert.equal(
      socialThemePreferredSourceUrl(context),
      "https://jumpingjaxllc.com/invitations/approved/sonic/card.png",
    );
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  }
});
