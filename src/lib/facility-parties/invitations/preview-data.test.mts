import assert from "node:assert/strict";
import test from "node:test";

import { MAX_INVITATION_ALTERNATE_LOADS } from "./match-theme.ts";
import {
  invitationDeliveryPreviewMode,
  toInvitationDeliveryPreviewData,
} from "./preview-data.ts";
import { buildInvitationSnapshot } from "./snapshot.ts";

test("maps delivery preferences to preview modes", () => {
  assert.equal(invitationDeliveryPreviewMode("print"), "print-sheet");
  assert.equal(invitationDeliveryPreviewMode("email"), "email-single");
  assert.equal(invitationDeliveryPreviewMode("office_pickup"), "office-pickup");
});

test("preview data adapter applies live form fields and fallbacks", () => {
  const snapshot = buildInvitationSnapshot("Sonic");
  const live = toInvitationDeliveryPreviewData({
    snapshot,
    childName: "Ava",
    childAge: "7",
    customerPhone: "864-555-0100",
    dateLabel: "Saturday, Sep 12",
    timeLabel: "2:00 PM - 3:30 PM",
  });
  assert.equal(live.childName, "Ava");
  assert.equal(live.childAge, "7");
  assert.equal(live.customerPhone, "864-555-0100");
  assert.equal(live.dateLabel, "Saturday, Sep 12");
  assert.equal(live.timeLabel, "2:00 PM - 3:30 PM");
  assert.equal(live.snapshot.themeId, "gamer-neon");
  assert.equal(live.venueName, "Jumping Jax");
  assert.equal(live.venueAddress, "559 Beaudrot Rd, Greenwood, SC");
  assert.equal(live.venuePhone, "864-933-1420");

  const fallback = toInvitationDeliveryPreviewData({
    snapshot,
    childName: "  ",
    childAge: "",
    dateLabel: null,
    timeLabel: undefined,
  });
  assert.equal(fallback.childName, "Birthday Star");
  assert.equal(fallback.childAge, "");
  assert.equal(fallback.dateLabel, "Date coming soon");
  assert.equal(fallback.timeLabel, "Time coming soon");
});

test("retry limit for invitation rematch stays at 3", () => {
  assert.equal(MAX_INVITATION_ALTERNATE_LOADS, 3);
});
