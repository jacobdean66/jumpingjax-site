import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { giveawayPartyLinkPath, parseGiveawayPartyLink } from "./party-rsvps.ts";
import { GiveawayPartyRoster } from "../../app/admin/giveaway/GiveawayPartyPanel.tsx";

test("month paths are isolated and malformed or cross-month links fail visibly", () => {
  assert.equal(giveawayPartyLinkPath("2026-10"), "giveaway-parties/2026-10.json");
  for (const month of ["../2026-10", "2026-13", "2026-1", "2026-10-01"]) assert.throws(() => giveawayPartyLinkPath(month));
  const link = { version: 1, drawMonth: "2026-10", bookingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", updatedAt: "2026-10-12", updatedBy: "Owner" };
  assert.deepEqual(parseGiveawayPartyLink(link, "2026-10"), link);
  assert.throws(() => parseGiveawayPartyLink(link, "2026-09"));
  assert.throws(() => parseGiveawayPartyLink({ ...link, bookingId: "bad-id" }, "2026-10"));
});

test("roster displays RSVP and arrival separately and escapes guest names", () => {
  const html = renderToStaticMarkup(React.createElement(GiveawayPartyRoster, { guests: [
    { id: "one", name: "<Test Child>", kind: "Child", rsvpedAt: "2026-10-12T19:00:00Z", checkedInAt: null },
    { id: "two", name: "Test Parent", kind: "Adult", rsvpedAt: "2026-10-12T19:00:00Z", checkedInAt: "2026-10-31T18:00:00Z" },
  ] }));
  assert.match(html, /&lt;Test Child&gt;/);
  assert.doesNotMatch(html, /<Test Child>/);
  assert.match(html, /RSVP — not checked in/);
  assert.match(html, /Checked in/);
  assert.match(html, /Child/);
  assert.match(html, /Adult/);
  const empty = renderToStaticMarkup(React.createElement(GiveawayPartyRoster, { guests: [] }));
  assert.match(empty, /No RSVPs yet/);
});

test("RSVP API is owner-only, private, and same-origin guarded before accessing storage", () => {
  const route = readFileSync(new URL("../../app/api/admin/giveaway/party/route.ts", import.meta.url), "utf8");
  assert.equal((route.match(/verifyAdminOwnerAccess\(\)/g) || []).length, 2);
  assert.match(route, /validateOwnerPost\(request\)/);
  assert.match(route, /expectedBookingId/);
  assert.match(route, /privateJson/);
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.ok(get.indexOf("if (!auth.ok)") < get.indexOf("loadGiveawayPartyView(drawMonth)"));
  assert.doesNotMatch(route, /send.*Email|set_giveaway_winner|setFacilityPartyGuestPresent/);
  const client = readFileSync(new URL("../../app/admin/giveaway/GiveawayDrawClient.tsx", import.meta.url), "utf8");
  assert.match(client, /selectedMonth === month.monthKey.*GiveawayPartyPanel/);
});
