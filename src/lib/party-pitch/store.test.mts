import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { EMPTY_CAMPAIGN, PARTY_PITCH_ID, parseEntry } from "./model.ts";
import { listPitchEntries, loadPitchCampaign, pitchEntryId, savePitchEntry, updatePitchReview } from "./store.ts";

const server = setupServer();
const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
before(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://party-pitch.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-placeholder";
  server.listen({ onUnhandledRequest: "error" });
});
after(() => {
  server.close();
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
});
const base = "https://party-pitch.invalid/rest/v1";
const input = parseEntry({ name: "Example Adult", email: "example@example.com", title: "Chair retirement", pitch: "A retirement party for the recliner that supported our family for twenty years.", zip: "29649", guests: 20, eventMonth: "2026-12", adultAcknowledged: true, rulesAcknowledged: true })!;

test("missing settings fail closed without initializing or opening a campaign", async () => {
  server.use(http.get(`${base}/campaign_events`, () => HttpResponse.json([])));
  assert.deepEqual(await loadPitchCampaign(), EMPTY_CAMPAIGN);
});
test("retries and repeated email submissions cannot overwrite an original pitch", async () => {
  let stored: Record<string, unknown> | undefined;
  server.use(http.post(`${base}/campaign_event_signups`, async ({ request }) => {
    assert.match(request.headers.get("prefer") ?? "", /resolution=ignore-duplicates/);
    const row = await request.json() as Record<string, unknown>;
    assert.equal(row.event_id, PARTY_PITCH_ID);
    if (stored) return HttpResponse.json([]);
    stored = row;
    return HttpResponse.json([{ id: row.id }]);
  }));
  const first = await savePitchEntry(input, { source: "google", medium: "display", campaign: PARTY_PITCH_ID, content: "example" });
  const second = await savePitchEntry({ ...input, details: { ...input.details, pitch: "A replacement should never erase the original." } }, { source: "", medium: "", campaign: "", content: "" });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.id, second.id);
  assert.equal(pitchEntryId(" EXAMPLE@EXAMPLE.COM "), first.id);
  assert.equal(JSON.parse(String(stored?.notes)).pitch, input.details.pitch);
});
test("dashboard reads beyond the first Supabase page and filters the contest", async () => {
  const offsets: number[] = [];
  server.use(http.get(`${base}/campaign_event_signups`, ({ request }) => {
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("event_id"), `eq.${PARTY_PITCH_ID}`);
    const offset = Number(url.searchParams.get("offset"));
    offsets.push(offset);
    return HttpResponse.json(Array.from({ length: offset === 0 ? 500 : 1 }, (_, i) => ({ id: `${offset + i}`, parent_name: "Example Adult", email: "example@example.com", phone: "", notes: JSON.stringify(input.details), utm_source: "google", created_at: "2026-10-30T18:00:00Z" })));
  }));
  const entries = await listPitchEntries();
  assert.equal(entries.length, 501);
  assert.deepEqual(offsets, [0, 500]);
});
test("concurrent reviewer edits do not silently lose another review", async () => {
  const original = JSON.stringify(input.details);
  server.use(
    http.get(`${base}/campaign_event_signups`, () => HttpResponse.json([{ notes: original }])),
    http.patch(`${base}/campaign_event_signups`, async ({ request }) => {
      const url = new URL(request.url);
      assert.equal(url.searchParams.get("event_id"), `eq.${PARTY_PITCH_ID}`);
      assert.equal(url.searchParams.get("notes"), `eq.${original}`);
      const updated = await request.json() as { notes: string };
      assert.equal(JSON.parse(updated.notes).pitch, input.details.pitch);
      return HttpResponse.json([]);
    }),
  );
  await assert.rejects(updatePitchReview(pitchEntryId(input.email), "reviewed", "Private notes"), /changed in another session/);
});
