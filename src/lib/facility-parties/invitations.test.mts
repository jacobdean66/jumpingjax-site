import assert from "node:assert/strict";
import test from "node:test";

import {
  approvedInvitationArtworkUrl,
  buildPublicFacilityInvitationUrl,
  buildFacilityWaiverInvitationUrl,
  buildQrCodeImageUrl,
  formatInvitationDeliveryPreferences,
  invitationTemplateLabel,
  invitationDeliveryPreferenceLabel,
  normalizeInvitationDeliveryPreference,
  normalizeInvitationDeliveryPreferences,
  normalizeInvitationTemplateId,
  resolveInvitationTheme,
} from "./invitations";
import {
  createFacilityInvitationShareToken,
  verifyFacilityInvitationShareToken,
} from "./invitation-share-token";

test("normalizes invitation delivery preference safely", () => {
  assert.equal(normalizeInvitationDeliveryPreference("email"), "email");
  assert.equal(
    normalizeInvitationDeliveryPreference("office_pickup"),
    "office_pickup",
  );
  assert.equal(normalizeInvitationDeliveryPreference("mail"), "print");
  assert.equal(invitationDeliveryPreferenceLabel("office_pickup"), "Office pickup");
});

test("normalizes multiple invitation delivery preferences safely", () => {
  assert.deepEqual(normalizeInvitationDeliveryPreferences("print,email"), [
    "print",
    "email",
  ]);
  assert.deepEqual(
    normalizeInvitationDeliveryPreferences([
      "office_pickup",
      "email",
      "email",
      "mail",
    ]),
    ["office_pickup", "email", "print"],
  );
  assert.deepEqual(normalizeInvitationDeliveryPreferences([]), ["print"]);
  assert.equal(
    formatInvitationDeliveryPreferences(["print", "email"]),
    "Print at home, Email invitations",
  );
});

test("resolves birthday invitation theme presets from booking theme text", () => {
  const gameTheme = resolveInvitationTheme("Sonic and Mario party");
  assert.equal(gameTheme.label, "Sonic Party");
  assert.equal(gameTheme.graphicLabel, "Sonic");
  assert.equal(gameTheme.graphicVariant, "game");
  assert.equal(gameTheme.approvedArtworkSlot, "sonic");
  assert.equal(resolveInvitationTheme("Pink princess").graphicVariant, "princess");
  assert.equal(resolveInvitationTheme("Soccer party").graphicVariant, "sports");
  assert.equal(resolveInvitationTheme("Neon glow").graphicVariant, "glow");
  assert.equal(resolveInvitationTheme("Superhero party").graphicVariant, "superhero");
  assert.equal(resolveInvitationTheme("Dino party").graphicVariant, "dinosaur");
  assert.equal(resolveInvitationTheme("Outer space").graphicLabel, "Space");
  assert.equal(resolveInvitationTheme("Outer space").graphicVariant, "space");
  assert.equal(resolveInvitationTheme("").label, "Birthday Party");
});

test("matches common kids themes and misspellings", () => {
  assert.equal(resolveInvitationTheme("mine craft").approvedArtworkSlot, "minecraft");
  assert.equal(resolveInvitationTheme("pawpatrol theme").approvedArtworkSlot, "paw-patrol");
  assert.equal(resolveInvitationTheme("spider man party").approvedArtworkSlot, "spider-hero");
  assert.equal(resolveInvitationTheme("clemson football").approvedArtworkSlot, "clemson");
  assert.equal(resolveInvitationTheme("gamecock football").approvedArtworkSlot, "gamecocks");
  assert.equal(resolveInvitationTheme("roblocks").approvedArtworkSlot, "roblox");
  assert.equal(resolveInvitationTheme("bluey and bingo").approvedArtworkSlot, "bluey");
  assert.equal(resolveInvitationTheme("random laser cats").graphicVariant, "party");
});

test("normalizes and labels invitation template choices", () => {
  assert.equal(normalizeInvitationTemplateId("ticket"), "ticket");
  assert.equal(normalizeInvitationTemplateId("poster"), "poster");
  assert.equal(normalizeInvitationTemplateId("unknown"), "spotlight");
  assert.equal(invitationTemplateLabel("spotlight"), "Character Spotlight");
});

test("builds approved artwork URLs only when an artwork base is configured", () => {
  const original = process.env.NEXT_PUBLIC_FACILITY_INVITATION_APPROVED_ARTWORK_BASE_URL;
  delete process.env.NEXT_PUBLIC_FACILITY_INVITATION_APPROVED_ARTWORK_BASE_URL;
  assert.equal(
    approvedInvitationArtworkUrl({
      partyTheme: "Sonic party",
      templateId: "spotlight",
    }),
    null,
  );

  process.env.NEXT_PUBLIC_FACILITY_INVITATION_APPROVED_ARTWORK_BASE_URL =
    "https://assets.example.com/invites/";
  assert.equal(
    approvedInvitationArtworkUrl({
      partyTheme: "Sonic party",
      templateId: "ticket",
    }),
    "https://assets.example.com/invites/sonic-ticket.png",
  );

  if (original === undefined) {
    delete process.env.NEXT_PUBLIC_FACILITY_INVITATION_APPROVED_ARTWORK_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_FACILITY_INVITATION_APPROVED_ARTWORK_BASE_URL = original;
  }
});

test("builds facility-party waiver URL without private child details", () => {
  const url = new URL(
    buildFacilityWaiverInvitationUrl({
      siteUrl: "http://localhost:3000",
      bookingId: "booking-123",
      partyDate: "2026-09-12",
    }),
  );
  assert.equal(url.origin, "http://localhost:3000");
  assert.equal(url.pathname, "/facility-party-check-in");
  assert.equal(url.searchParams.get("booking"), "booking-123");
  assert.equal(url.searchParams.get("date"), "2026-09-12");
  assert.equal(url.searchParams.has("child"), false);
});

test("builds signed public invitation links", () => {
  const previousSecret = process.env.INVITATION_SHARE_SECRET;
  process.env.INVITATION_SHARE_SECRET = "x".repeat(40);
  const token = createFacilityInvitationShareToken("booking-123");
  const result = verifyFacilityInvitationShareToken(token, "booking-123");
  assert.equal(result.ok, true);
  assert.equal(verifyFacilityInvitationShareToken(token, "wrong-booking").ok, false);

  const sheet = new URL(
    buildPublicFacilityInvitationUrl({
      siteUrl: "https://jumpingjaxllc.com",
      bookingId: "booking-123",
      token,
      layout: "sheet",
    }),
  );
  assert.equal(sheet.pathname, "/facility-party-invitations/booking-123");
  assert.equal(sheet.searchParams.get("token"), token);
  assert.equal(sheet.searchParams.has("layout"), false);

  const single = new URL(
    buildPublicFacilityInvitationUrl({
      siteUrl: "https://jumpingjaxllc.com",
      bookingId: "booking-123",
      token,
      layout: "single",
    }),
  );
  assert.equal(single.searchParams.get("layout"), "single");

  if (previousSecret === undefined) {
    delete process.env.INVITATION_SHARE_SECRET;
  } else {
    process.env.INVITATION_SHARE_SECRET = previousSecret;
  }
});

test("builds bounded QR code URL", () => {
  const qr = new URL(buildQrCodeImageUrl("https://example.com/waiver", 900));
  assert.equal(qr.hostname, "api.qrserver.com");
  assert.equal(qr.searchParams.get("size"), "600x600");
  assert.equal(qr.searchParams.get("data"), "https://example.com/waiver");
});
