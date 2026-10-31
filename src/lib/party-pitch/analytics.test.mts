import assert from "node:assert/strict";
import test from "node:test";
import { pitchChannel, summarizePitchEntries, PARTY_PITCH_AD_URL } from "./analytics.ts";
import { EMPTY_CAMPAIGN, normalizeCampaign } from "./model.ts";

test("applications are deduplicated and grouped by Eastern submission date and original channel", () => {
  const rows = [
    { id: "one", createdAt: "2026-11-01T03:59:59Z", source: "google", medium: "display", status: "new" as const },
    { id: "two", createdAt: "2026-11-01T04:00:00Z", source: "google", medium: "display", status: "shortlisted" as const },
    { id: "two", createdAt: "2026-11-01T04:00:00Z", source: "email", medium: "email", status: "new" as const },
    { id: "three", createdAt: "2026-11-02T04:59:59Z", source: "", status: "new" as const },
    { id: "four", createdAt: "2026-11-02T05:00:00Z", source: "google", medium: "cpc", status: "new" as const },
    { id: "bad", createdAt: "invalid", source: "google", status: "new" as const },
  ];
  assert.deepEqual(summarizePitchEntries(rows, "2026-11-01", "2026-11-01"), {
    entries: 2, shortlisted: 1, sources: [{ channel: "Direct / unspecified", entries: 1 }, { channel: "Google Display", entries: 1 }], daily: [{ date: "2026-11-01", entries: 2 }],
  });
});

test("unknown UTM values cannot leak contact details into aggregate channel labels", () => {
  assert.equal(pitchChannel("private@example.com"), "Other");
  assert.equal(pitchChannel("GOOGLE", "display"), "Google Display");
  assert.equal(pitchChannel("google", "cpc"), "Google (other / unspecified)");
  assert.equal(pitchChannel("instagram"), "Instagram");
  const report = summarizePitchEntries([{ id: "one", createdAt: "2026-10-31T16:00:00Z", source: "private@example.com", status: "new", name: "Private person", email: "private@example.com", pitch: "Private pitch" } as never], "2026-10-31", "2026-10-31");
  assert.doesNotMatch(JSON.stringify(report), /private|person|pitch/i);
});

test("poster destination identifies the Display campaign without a draft campaign identifier", () => {
  const url = new URL(PARTY_PITCH_AD_URL);
  assert.equal(url.pathname, "/campaigns/ridiculous-party-pitch");
  assert.equal(url.searchParams.get("utm_source"), "google");
  assert.equal(url.searchParams.get("utm_medium"), "display");
  assert.equal(url.searchParams.has("campaignId"), false);
});

test("older stored contest settings remain valid without a reporting ID", () => {
  const { googleCampaignId: _id, ...old } = EMPTY_CAMPAIGN;
  assert.equal(normalizeCampaign(old).googleCampaignId, "");
  assert.equal(normalizeCampaign({ ...old, googleCampaignId: "123456" }).googleCampaignId, "123456");
});
