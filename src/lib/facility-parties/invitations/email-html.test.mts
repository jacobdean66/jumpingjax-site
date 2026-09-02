import assert from "node:assert/strict";
import test from "node:test";

import { buildInvitationSnapshot } from "./snapshot.ts";
import { buildFullInvitationEmailHtml } from "./email-html.ts";

test("full invitation email includes the themed invitation and forwarding actions", () => {
  const html = buildFullInvitationEmailHtml({
    snapshot: buildInvitationSnapshot("Frozen princess"),
    siteUrl: "https://jumpingjaxllc.com",
    plainText: "Your booking is confirmed.",
    childName: "Emma",
    childAge: "7",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM - 3:30 PM",
    themeText: "Frozen princess",
    invitationUrl: "/facility-parties/invitations/booking-123",
    printableUrl: "/facility-parties/invitations/booking-123/sheet",
    waiverUrl: "/facility-party-check-in?booking=booking-123",
  });

  assert.match(html, /data-full-page-invitation="true"/);
  assert.match(html, /Emma is turning 7!/);
  assert.match(html, /A Frozen princess birthday celebration/);
  assert.match(html, /Saturday, August 22, 2026/);
  assert.match(html, /Open &amp; share invitation/);
  assert.match(html, /Print 4 per page/);
  assert.match(html, /RSVP &amp; waiver/);
  assert.match(html, /https:\/\/jumpingjaxllc\.com\/invitation-library\/themes\/princess-royal\/princess\.png/);
  assert.match(html, /Forward this email/);
});

test("full invitation email escapes customer-provided text", () => {
  const html = buildFullInvitationEmailHtml({
    snapshot: buildInvitationSnapshot("Princess"),
    siteUrl: "https://jumpingjaxllc.com",
    plainText: "Saved <safely>",
    childName: "<Emma>",
    childAge: "7",
    dateLabel: "Saturday",
    timeLabel: "2 PM",
    themeText: "Princess",
  });

  assert.doesNotMatch(html, /<Emma>/);
  assert.match(html, /&lt;Emma&gt;/);
  assert.match(html, /Saved &lt;safely&gt;/);
});
