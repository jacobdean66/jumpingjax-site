import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { InvitationDeliveryPreview } from "./InvitationDeliveryPreview.tsx";
import { InvitationSheet } from "./InvitationSheet.tsx";
import { buildInvitationSnapshot } from "../../lib/facility-parties/invitations/snapshot.ts";

const snapshot = buildInvitationSnapshot("Sonic");
const formFields = {
  snapshot,
  childName: "Milo",
  childAge: "6",
  dateLabel: "Friday, Oct 3",
  timeLabel: "4:00 PM - 5:30 PM",
};

function countMatches(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

test("all three delivery option previews render distinct modes", () => {
  const printHtml = renderToStaticMarkup(
    createElement(InvitationDeliveryPreview, {
      preference: "print",
      active: true,
      ...formFields,
    }),
  );
  const emailHtml = renderToStaticMarkup(
    createElement(InvitationDeliveryPreview, {
      preference: "email",
      active: false,
      ...formFields,
    }),
  );
  const pickupHtml = renderToStaticMarkup(
    createElement(InvitationDeliveryPreview, {
      preference: "office_pickup",
      active: false,
      ...formFields,
    }),
  );

  assert.match(printHtml, /data-preview-mode="print-sheet"/);
  assert.match(printHtml, /data-invite-count="4"/);
  assert.equal(countMatches(printHtml, "data-invite-instance"), 4);
  assert.match(printHtml, /data-print-preview="readable"/);
  assert.match(printHtml, /data-sheet-readable="true"/);
  assert.match(printHtml, /Milo/);
  assert.match(printHtml, /Letter/);
  assert.match(printHtml, /Selected/);

  assert.match(emailHtml, /data-preview-mode="email-single"/);
  assert.match(emailHtml, /data-invite-count="1"/);
  assert.equal(countMatches(emailHtml, "data-invite-instance"), 1);
  assert.match(emailHtml, /Milo/);
  assert.match(emailHtml, /Friday, Oct 3/);
  assert.match(emailHtml, /Tap to choose/);

  assert.match(pickupHtml, /data-preview-mode="office-pickup"/);
  assert.match(pickupHtml, /data-pickup-treatment="print-ready"/);
  assert.match(pickupHtml, /Print-ready/);
  assert.match(pickupHtml, /Receive in person/);
  assert.match(pickupHtml, /data-invite-count="1"/);
});

test("selecting a preference surfaces selected state without changing snapshot fields", () => {
  const html = renderToStaticMarkup(
    createElement(InvitationDeliveryPreview, {
      preference: "email",
      active: true,
      ...formFields,
    }),
  );
  assert.match(html, /data-selected="true"/);
  assert.match(html, /data-delivery-preference="email"/);
  assert.match(html, /data-theme-id="gamer-neon"/);
  assert.match(html, /turning 6/);
});

test("printable sheet output stays 4-up with the same invitation renderer", () => {
  const sheetHtml = renderToStaticMarkup(
    createElement(InvitationSheet, formFields),
  );
  assert.match(sheetHtml, /data-print-layout="letter-4up"/);
  assert.equal(countMatches(sheetHtml, "data-invite-instance"), 4);
  assert.equal(countMatches(sheetHtml, 'data-theme-id="gamer-neon"'), 4);
  assert.match(sheetHtml, /Milo/);
});
