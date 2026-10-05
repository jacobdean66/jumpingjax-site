import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PartyInvitationCard } from "../../../components/facility-parties/PartyInvitationCard.tsx";
import { InvitationSheet } from "../../../components/facility-parties/InvitationSheet.tsx";
import { invitationSnapshotFromChoice, resolveInvitationSnapshot } from "./snapshot.ts";
import { invitationNeedsArtworkConfirmation, InvitationArtworkRequiredError } from "./artwork-policy.ts";
import { runInvitationAgent, INVITATION_AGENT_ACTIONS } from "./agent.ts";
import { buildFullInvitationEmailHtml } from "./email-html.ts";
import { buildEditableInvitationPptx } from "./editable-pptx.ts";

const details = { childName: "Michael", childAge: "5", dateLabel: "November 29, 2026", timeLabel: "2–4 PM" };
const themes = ["Spidey and His Amazing Friends", "Spider-Man", "Toy Story", "Call of Duty", "Halo", "Cars", "Frozen princess", "Curious George", "An unknown character", "Sonic but the movie version", "Toy Story with Sonic"];

test("missing and legacy snapshots never render unrelated artwork or deliver a themed file", async () => {
  for (const partyTheme of themes) {
    for (const stored of [null, invitationSnapshotFromChoice(partyTheme), { ...invitationSnapshotFromChoice(partyTheme), themeId: "gamer-neon" }]) {
      const snapshot = resolveInvitationSnapshot({ partyTheme, stored });
      assert.equal(invitationNeedsArtworkConfirmation(snapshot), true, partyTheme);
      const props = { snapshot, ...details };
      for (const element of [React.createElement(PartyInvitationCard, props), React.createElement(InvitationSheet, props)]) {
        const html = renderToStaticMarkup(element);
        assert.match(html, /data-invitation-artwork="needs-confirmation"/);
        assert.doesNotMatch(html, /<img|controller\.png|\/invitation-library\/|\/invitations\/approved\//);
      }
      assert.throws(() => buildFullInvitationEmailHtml({ ...props, siteUrl: "https://example.com", plainText: "Test" }), InvitationArtworkRequiredError);
      await assert.rejects(buildEditableInvitationPptx({ ...props, invitationQuantity: 4 }), InvitationArtworkRequiredError);
    }
    for (const action of INVITATION_AGENT_ACTIONS) {
      const result = runInvitationAgent({ action, sourceText: partyTheme });
      assert.equal(result.status, "needs_theme_confirmation", `${partyTheme}: ${action}`);
      assert.deepEqual(result.usedLibraries, []);
    }
  }
});

test("verified pictures survive all layouts, reload, and single/four-up rendering", () => {
  for (const label of themes.slice(0, 6)) {
    const theme = { id: "verified", label, description: "Verified character picture", originalQuery: label,
      imageUrl: "https://example.com/character.png", sourceUrl: "https://example.com/character", imagePath: `/api/facility/invitations/artwork/${"a".repeat(64)}`, confirmedAt: "2026-10-05T12:00:00.000Z" };
    for (let optionIndex = 0; optionIndex < 3; optionIndex++) {
      const stored = invitationSnapshotFromChoice(label, optionIndex, 0, "", theme);
      const snapshot = resolveInvitationSnapshot({ partyTheme: label, stored: JSON.parse(JSON.stringify(stored)) });
      assert.equal(invitationNeedsArtworkConfirmation(snapshot), false);
      const html = renderToStaticMarkup(React.createElement(InvitationSheet, { snapshot, ...details, invitationQuantity: 4 }));
      assert.equal((html.match(/<img\b[^>]*>/g) || []).filter(tag => tag.includes(theme.imagePath)).length, 4);
      assert.doesNotMatch(html, /controller\.png|\/invitation-library\/|needs-confirmation/);
      assert.ok(buildFullInvitationEmailHtml({ snapshot, ...details, siteUrl: "https://example.com", plainText: "Test" }).includes(theme.imagePath));
    }
  }
});

test("approved local character art requires a whole-theme match, not a substring", () => {
  for (const label of ["Sonic", "Sonic party", "Minecraft", "Transformers", "camouflage"]) assert.equal(invitationNeedsArtworkConfirmation(invitationSnapshotFromChoice(label)), false, label);
  assert.equal(invitationNeedsArtworkConfirmation(invitationSnapshotFromChoice("")), false);
});

test("saved confirmation does not override an uncertain character identity", () => {
  const theme={id:"verified",label:"Halo Master Chief",description:"Resembles Master Chief",originalQuery:"Halo",imageUrl:"https://example.com/halo.png",sourceUrl:"https://example.com/halo",imagePath:`/api/facility/invitations/artwork/${"a".repeat(64)}`,confirmedAt:"2026-10-05T12:00:00.000Z"};
  const stored=invitationSnapshotFromChoice(theme.label,0,0,"",theme);
  assert.equal(invitationNeedsArtworkConfirmation(resolveInvitationSnapshot({partyTheme:theme.label,stored})),true);
  assert.equal(runInvitationAgent({action:"view-single",sourceText:theme.label,confirmedTheme:theme}).status,"needs_theme_confirmation");
});
