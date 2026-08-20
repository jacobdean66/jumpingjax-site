import assert from "node:assert/strict";
import test from "node:test";

import {
  approvedInvitationArtworkUrl,
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

test("normalizes invitation delivery preference safely", () => {
  assert.equal(normalizeInvitationDeliveryPreference("email"), "email");
  assert.equal(
    normalizeInvitationDeliveryPreference("office_pickup"),
    "office_pickup",
  );
  assert.equal(normalizeInvitationDeliveryPreference("mail"), "print");
  assert.equal(invitationDeliveryPreferenceLabel("office_pickup"), "Receive in person");
  assert.equal(
    invitationDeliveryPreferenceLabel("print"),
    "Printable sheet (4 per page)",
  );
  assert.equal(
    invitationDeliveryPreferenceLabel("email"),
    "Email invitation (single)",
  );
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
    "Printable sheet (4 per page), Email invitation (single)",
  );
});

test("resolves birthday invitation theme presets from booking theme text", () => {
  const gameTheme = resolveInvitationTheme("Sonic and Mario party");
  assert.equal(gameTheme.label, "Game Party");
  assert.equal(gameTheme.graphicLabel, "Sonic");
  assert.equal(gameTheme.graphicVariant, "game");
  assert.equal(gameTheme.approvedArtworkSlot, "sonic");
  assert.equal(resolveInvitationTheme("Pink princess").graphicVariant, "princess");
  assert.equal(resolveInvitationTheme("Soccer party").graphicVariant, "sports");
  assert.equal(resolveInvitationTheme("Neon glow").graphicVariant, "glow");
  assert.equal(resolveInvitationTheme("Superhero party").graphicVariant, "superhero");
  assert.equal(resolveInvitationTheme("Dino party").graphicVariant, "dinosaur");
  assert.equal(resolveInvitationTheme("Outer space").graphicLabel, "Outer space");
  assert.equal(resolveInvitationTheme("Outer space").graphicVariant, "party");
  assert.equal(resolveInvitationTheme("").label, "Birthday Party");
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

test("builds bounded QR code URL", () => {
  const qr = new URL(buildQrCodeImageUrl("https://example.com/waiver", 900));
  assert.equal(qr.hostname, "api.qrserver.com");
  assert.equal(qr.searchParams.get("size"), "600x600");
  assert.equal(qr.searchParams.get("data"), "https://example.com/waiver");
});
