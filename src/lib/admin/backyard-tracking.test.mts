import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BACKYARD_CAMPAIGN } from "./backyard-takeover";
import { DEFAULT_BACKYARD_SETTINGS, backyardTimeInput, backyardTimeUtc, entriesAreOpen, entryReadiness, normalizeBackyardSettings, readAttribution, trackedLink, trackingAllowed } from "./backyard-tracking";

test("opening requires final prize, rules, explicit review and a valid entry window", () => {
  assert.ok(entryReadiness(DEFAULT_BACKYARD_CAMPAIGN, DEFAULT_BACKYARD_SETTINGS).length >= 4);
  const campaign = { ...DEFAULT_BACKYARD_CAMPAIGN, status: "published" as const, prize: "One selected inflatable rental package with local delivery.", rules: "Final official contest rules. ".repeat(10) };
  const settings = { ...DEFAULT_BACKYARD_SETTINGS, opensAt: "2026-11-01T14:00:00Z", closesAt: "2026-11-21T22:00:00Z", announcesOn: "2026-11-25", retailValue: "500.00", rulesConfirmed: true };
  assert.deepEqual(entryReadiness(campaign, settings), []);
  assert.equal(entriesAreOpen(campaign, settings, Date.parse("2026-11-10T15:00:00Z")), true);
  assert.equal(entriesAreOpen({ ...campaign, status: "draft" }, settings, Date.parse("2026-11-10T15:00:00Z")), false);
  assert.equal(entriesAreOpen(campaign, { ...settings, rulesConfirmed: false }, Date.parse("2026-11-10T15:00:00Z")), false);
  assert.equal(entriesAreOpen(campaign, settings, Date.parse(settings.closesAt)), false);
  assert.equal(entriesAreOpen(campaign, settings, Date.parse("2026-10-31T15:00:00Z")), false);
});

test("business times use Eastern time across daylight saving transitions and reject impossible dates", () => {
  assert.equal(backyardTimeUtc("2026-10-30T09:00"), "2026-10-30T13:00:00.000Z");
  assert.equal(backyardTimeUtc("2026-11-02T09:00"), "2026-11-02T14:00:00.000Z");
  assert.equal(backyardTimeInput("2026-11-02T14:00:00Z"), "2026-11-02T09:00");
  assert.throws(() => backyardTimeUtc("2026-03-08T02:30"), /daylight saving/);
  assert.throws(() => backyardTimeUtc("2026-02-30T09:00"), /valid calendar/);
  assert.equal(backyardTimeUtc(""), "");
});

test("attribution is allowlisted; unknown query values and unresolved platform macros are not stored", () => {
  const data = readAttribution(new URLSearchParams("utm_source=google&utm_medium=cpc&gclid=abc-12_3&campaign_id=123456&ad_id=789&email=private@example.com&token=never-store"));
  assert.equal(data.source, "google"); assert.equal(data.gclid, "abc-12_3"); assert.equal(data.adCampaignId, "123456");
  assert.doesNotMatch(JSON.stringify(data), /private@example|never-store|email|token/);
  assert.equal(readAttribution(new URLSearchParams("campaign_id={campaignid}")).adCampaignId, "");
  assert.equal(readAttribution(new URLSearchParams("fbclid=someid")).source, "facebook");
  assert.equal(readAttribution(new URLSearchParams("utm_source=unknown")).source, "other");
});

test("tracking respects browser opt-outs, known link previews and bots", () => {
  for (const headers of [{ dnt: "1" }, { "sec-gpc": "1" }, { "user-agent": "facebookexternalhit/1.1" }, { "user-agent": "Googlebot" }]) assert.equal(trackingAllowed(new Headers(headers)), false);
  assert.equal(trackingAllowed(new Headers({ "user-agent": "Mozilla/5.0 Chrome/131.0 Safari/537.36" })), true);
});

test("destination links are scoped to the approved campaign and never contain credentials", () => {
  for (const source of ["google","facebook","instagram"] as const) {
    const url = new URL(trackedLink(source));
    assert.equal(url.origin, "https://jumpingjaxllc.com");
    assert.equal(url.pathname, "/go/backyard-takeover");
    assert.equal(url.searchParams.get("utm_source"), source);
    assert.equal(url.searchParams.get("utm_content"), "duck_jeep_v5");
  }
  assert.equal(normalizeBackyardSettings({ rulesConfirmed: "true" }).rulesConfirmed, false);
});
