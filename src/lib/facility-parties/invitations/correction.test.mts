import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { correctionPlanSchema, correctionSaveSchema, invitationCorrectionHref, isInvitationCorrectionRequest } from "./correction";
import { supervisorNetworkRequest } from "@/lib/agent-manager/network/supervisor-routing";
import { buildInvitationCopy } from "./content";
import { resolveInvitationSnapshot } from "./snapshot";
import { ConfirmedInvitationCard } from "@/components/facility-parties/ConfirmedInvitationCard";

const theme = { id: "test-artwork", label: "Dinosaur", originalQuery: "Dinosaur", description: "Green dinosaur artwork", imageUrl: "https://example.com/art.png", sourceUrl: "https://example.com/art", imagePath: `/api/facility/invitations/artwork/${"a".repeat(64)}`, confirmedAt: "2026-10-23T00:00:00Z" };

test("natural invitation correction requests delegate to the invitation agent and retain their exact instructions", () => {
  const message = "Fix the invitation wording and replace its picture with a dinosaur";
  assert.equal(isInvitationCorrectionRequest(message), true);
  assert.equal(isInvitationCorrectionRequest("Change the invite picture"), true);
  assert.equal(isInvitationCorrectionRequest("Do not change the invitation"), false);
  assert.equal(isInvitationCorrectionRequest("Check website health"), false);
  assert.equal(isInvitationCorrectionRequest("Fix the invitation tool source code"), false);
  const request = supervisorNetworkRequest(message);
  assert.equal(request?.recipient, "party-invitation");
  assert.equal(request?.skill, "invitation_correction");
  assert.deepEqual(request?.input, { message });
  assert.equal(supervisorNetworkRequest("Ask Invitation Agent to revise the wording")?.skill, "invitation_correction");
  assert.equal(new URL(invitationCorrectionHref(message), "https://example.com").searchParams.get("correction"), message);
  assert.equal(new URL(invitationCorrectionHref(message, "party-id"), "https://example.com").pathname, "/admin/facility/party-id/invitations");
});

test("corrections cannot supply booking changes, image URLs, commands or unbounded copy", () => {
  const plan = { headline: "Come celebrate with {name}!", optionIndex: 2, artworkQuery: "dinosaur", explanation: "A friendlier message, banner layout and a new picture to confirm." };
  assert.ok(correctionPlanSchema.safeParse(plan).success);
  for (const patch of [{ headline: "x".repeat(101) }, { headline: "<script>bad</script>" }, { optionIndex: 3 }, { imageUrl: "https://evil.test" }, { bookingDate: "2026-12-01" }]) assert.equal(correctionPlanSchema.safeParse({ ...plan, ...patch }).success, false);
  assert.equal(correctionSaveSchema.safeParse({ baseRevision: "a".repeat(64), headline: "Hello {name}", optionIndex: 1, sourceText: "Dinosaur", bookingDate: "changed" }).success, false);
});

test("saved wording survives snapshot reconstruction and renders with party placeholders and fixed facts", () => {
  const snapshot = resolveInvitationSnapshot({ partyTheme: "Dinosaur", stored: { confirmedTheme: theme, optionIndex: 2, customHeadline: "Come celebrate {name}, turning {age}!" } });
  assert.equal(snapshot.customHeadline, "Come celebrate {name}, turning {age}!");
  const copy = buildInvitationCopy({ childName: "Test Child", childAge: "7", dateLabel: "Test date", timeLabel: "Test time", customHeadline: snapshot.customHeadline });
  assert.equal(copy.headline, "Come celebrate Test Child, turning 7!");
  assert.equal(copy.dateLabel, "Test date");
  assert.equal(copy.timeLabel, "Test time");
  const html = renderToStaticMarkup(createElement(ConfirmedInvitationCard, { snapshot, childName: "Test Child", childAge: "7", dateLabel: "Test date", timeLabel: "Test time", qrUrl: "/test-qr", waiverUrl: "/test-check-in" }));
  assert.match(html, /Come celebrate Test Child, turning 7!/);
  assert.match(html, /data-confirmed-layout="banner"/);
  assert.match(html, /Test date/);
  assert.match(html, /Test time/);
  assert.match(html, /test-check-in/);
});
