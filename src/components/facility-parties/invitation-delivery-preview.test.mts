import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { InvitationDeliveryPreview } from "./InvitationDeliveryPreview.tsx";
import { InvitationSheet } from "./InvitationSheet.tsx";
import { AdminShell } from "../../app/admin/_components.tsx";
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
  assert.equal(countMatches(printHtml, 'data-invitation-brand="jumping-jax"'), 0);
  assert.equal(countMatches(printHtml, 'data-logo-treatment="transparent"'), 0);
  assert.equal(countMatches(printHtml, 'data-invitation-size="5.5x4.25-landscape"'), 4);
  assert.equal(countMatches(printHtml, 'data-source-theme-treatment="speedster-blue"'), 4);
  assert.equal(countMatches(printHtml, 'data-approved-theme-artwork="true"'), 4);
  assert.equal(countMatches(printHtml, 'src="\/logo.png"'), 0);
  assert.match(printHtml, /Milo/);
  assert.match(printHtml, /Letter/);
  assert.match(printHtml, /5.5/);
  assert.match(printHtml, /Selected/);

  assert.match(emailHtml, /data-preview-mode="email-single"/);
  assert.match(emailHtml, /data-invite-count="1"/);
  assert.equal(countMatches(emailHtml, 'data-invitation-brand="jumping-jax"'), 0);
  assert.equal(countMatches(emailHtml, 'data-logo-treatment="transparent"'), 0);
  assert.equal(countMatches(emailHtml, "data-invite-instance"), 1);
  assert.match(emailHtml, /Milo/);
  assert.match(emailHtml, /Friday, Oct 3/);
  assert.match(emailHtml, /Tap to choose/);

  assert.match(pickupHtml, /data-preview-mode="office-pickup"/);
  assert.match(pickupHtml, /data-pickup-treatment="print-ready"/);
  assert.match(pickupHtml, /Print-ready/);
  assert.match(pickupHtml, /Receive in person/);
  assert.match(pickupHtml, /data-invite-count="1"/);
  assert.equal(countMatches(pickupHtml, 'data-invitation-brand="jumping-jax"'), 0);
  assert.equal(countMatches(pickupHtml, 'data-logo-treatment="transparent"'), 0);
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
  assert.match(html, /data-source-theme-treatment="speedster-blue"/);
  assert.match(html, /turning 6/);
});

test("printable sheets render four equal landscape invitations per letter page", () => {
  const sheetHtml = renderToStaticMarkup(
    createElement(InvitationSheet, {
      ...formFields,
      qrUrl: "/test-party-qr.png",
      waiverUrl: "https://example.com/waiver",
      invitationQuantity: 12,
    }),
  );
  assert.match(sheetHtml, /data-print-layout="letter-landscape-4up"/);
  assert.match(sheetHtml, /data-invitation-format="5.5x4.25-landscape"/);
  assert.match(sheetHtml, /data-invite-count="12"/);
  assert.equal(countMatches(sheetHtml, "data-print-page="), 3);
  assert.equal(countMatches(sheetHtml, "data-invite-instance"), 12);
  assert.equal(countMatches(sheetHtml, 'data-theme-id="gamer-neon"'), 12);
  assert.equal(countMatches(sheetHtml, 'data-invitation-brand="jumping-jax"'), 0);
  assert.equal(countMatches(sheetHtml, 'data-logo-treatment="transparent"'), 0);
  assert.equal(countMatches(sheetHtml, 'src="\/logo.png"'), 0);
  assert.equal(countMatches(sheetHtml, 'data-approved-theme-artwork="true"'), 12);
  assert.equal(countMatches(sheetHtml, 'data-invitation-size="5.5x4.25-landscape"'), 12);
  assert.equal(countMatches(sheetHtml, 'data-invitation-qr="true"'), 12);
  assert.equal(countMatches(sheetHtml, 'data-qr-size="large"'), 12);
  assert.equal(countMatches(sheetHtml, 'data-child-name-age="true"'), 12);
  assert.equal(countMatches(sheetHtml, "Milo"), 12);
  assert.equal(countMatches(sheetHtml, "is turning 6!"), 12);
});

test("admin print container removes dashboard padding around letter sheets", () => {
  const html = renderToStaticMarkup(
    createElement(
      AdminShell,
      null,
      createElement(InvitationSheet, {
        ...formFields,
        invitationQuantity: 4,
      }),
    ),
  );

  assert.match(html, /print:m-0 print:max-w-none print:p-0/);
  assert.match(html, /width: 11in !important/);
  assert.match(html, /height: 8.5in !important/);
  assert.match(html, /print-color-adjust: exact !important/);
  assert.equal(countMatches(html, "data-print-page="), 1);
});
