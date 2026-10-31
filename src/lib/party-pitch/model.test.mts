import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_CAMPAIGN, campaignIssues, entriesOpen, normalizeCampaign, parseEntry, type PitchCampaign } from "./model.ts";
import { adminNavigation } from "../admin/navigation.ts";

const campaign: PitchCampaign = { status: "published", prize: "A test-only rental package with all delivery and mandatory costs covered.", retailValue: "400.00", eligibleArea: "Test area", opensOn: "2026-10-30", closesOn: "2026-11-01", announcesOn: "2026-11-02", rules: "Test-only rules describing eligibility and exclusions, free entry, one judged prize, judging criteria, tie handling, notification, and fulfillment arrangements." };
const entrant = { name: "Example Adult", email: "  EXAMPLE@EXAMPLE.COM ", title: "Retire the recliner", pitch: "We will gather our friends for a retirement reception for the chair that supported us for twenty years.", zip: "29649", guests: 20, eventMonth: "2026-12", adultAcknowledged: true, rulesAcknowledged: true };

test("draft, paused, closed, incomplete, and invalid schedules never accept entries", () => {
  const now = new Date("2026-10-30T18:00:00Z");
  for (const status of ["draft", "paused", "closed"] as const) assert.equal(entriesOpen({ ...campaign, status }, now), false);
  assert.equal(entriesOpen({ ...EMPTY_CAMPAIGN, status: "published", rules: "" }, now), false);
  assert.equal(entriesOpen({ ...campaign, closesOn: "2026-02-30" }, now), false);
  assert.ok(campaignIssues({ ...campaign, announcesOn: campaign.closesOn }).length);
  assert.equal(entriesOpen(campaign, now), true);
});
test("entry window uses Eastern midnight across the daylight saving transition", () => {
  assert.equal(entriesOpen(campaign, new Date("2026-10-30T03:59:59Z")), false);
  assert.equal(entriesOpen(campaign, new Date("2026-10-30T04:00:00Z")), true);
  assert.equal(entriesOpen(campaign, new Date("2026-11-02T04:59:59Z")), true);
  assert.equal(entriesOpen(campaign, new Date("2026-11-02T05:00:00Z")), false);
});
test("entries require valid contact, an actual pitch, and explicit eligibility acknowledgments", () => {
  assert.equal(parseEntry(entrant)?.email, "example@example.com");
  for (const change of [{ email: "bad" }, { guests: 1.5 }, { zip: "296" }, { eventMonth: "2026-13" }, { adultAcknowledged: "true" }, { rulesAcknowledged: false }, { pitch: "a ".repeat(151) }, { title: "" }]) assert.equal(parseEntry({ ...entrant, ...change }), null);
  assert.equal(parseEntry([]), null);
});
test("public input cannot choose review status or inject private notes", () => {
  const parsed = parseEntry({ ...entrant, status: "shortlisted", reviewNotes: "Pick me", name: "   Example Adult   " });
  assert.equal(parsed?.name, "Example Adult");
  assert.equal(parsed?.details.status, "new");
  assert.equal(parsed?.details.reviewNotes, "");
  assert.equal(normalizeCampaign(null).status, "draft");
});
test("only the owner navigation exposes applicant records", () => {
  const links = (role: "owner" | "employee") => adminNavigation(role).groups.flatMap(g => g.items).map(i => i.href);
  assert.ok(links("owner").includes("/admin/party-pitches"));
  assert.ok(!links("employee").includes("/admin/party-pitches"));
});
