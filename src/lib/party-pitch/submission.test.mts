import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { POST } from "../../app/api/campaigns/ridiculous-party-pitch/route.ts";
import { EMPTY_CAMPAIGN, PARTY_PITCH_ID, easternDate } from "./model.ts";

const server = setupServer();
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
before(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://party-pitch.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-placeholder";
  server.listen({ onUnhandledRequest: "error" });
});
after(() => {
  server.close();
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});
const url = "https://jumpingjax.example/api/campaigns/ridiculous-party-pitch";
let sequence = 0;
function request(body: unknown, origin = "https://jumpingjax.example") {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json", origin, "x-forwarded-for": `test-${sequence++}` }, body: JSON.stringify(body) });
}
const entrant = { name: "Example Adult", email: "example@example.com", title: "Chair retirement", pitch: "A retirement party for the recliner that supported our family for twenty years.", zip: "29649", guests: 20, eventMonth: "2026-12", adultAcknowledged: true, rulesAcknowledged: true };

test("cross-origin submissions are blocked before reaching storage", async () => {
  const response = await POST(request(entrant, "https://unrelated.example"));
  assert.equal(response.status, 403);
});
test("a missing/draft campaign rejects submissions without saving an entry", async () => {
  server.use(http.get("https://party-pitch.invalid/rest/v1/campaign_events", () => HttpResponse.json([])));
  const response = await POST(request(entrant));
  assert.equal(response.status, 410);
  assert.equal((await response.json()).id, undefined);
});
test("confirmation is returned only after the database accepts the application", async () => {
  const config = { ...EMPTY_CAMPAIGN, status: "published", prize: "Test-only package with mandatory fees included.", retailValue: "400", eligibleArea: "Test area", opensOn: easternDate(), closesOn: easternDate(), announcesOn: "2099-12-31", rules: "Test-only rules: adults in the eligible area may submit an original pitch without purchase. Judges score humor and originality. Ties are resolved by a written comparison. One prize is awarded." };
  server.use(http.get("https://party-pitch.invalid/rest/v1/campaign_events", () => HttpResponse.json([{ status: "published", rules_text: JSON.stringify({ kind: PARTY_PITCH_ID, version: 1, config }) }])));
  let saved = false;
  server.use(http.post("https://party-pitch.invalid/rest/v1/campaign_event_signups", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    assert.equal(body.parent_name, entrant.name);
    assert.equal(JSON.parse(String(body.notes)).pitch, entrant.pitch);
    saved = true;
    return HttpResponse.json([{ id: body.id }]);
  }));
  const response = await POST(request(entrant));
  assert.equal(response.status, 200);
  assert.equal(saved, true);
  assert.match((await response.json()).id, /^[\da-f-]{36}$/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  server.use(http.post("https://party-pitch.invalid/rest/v1/campaign_event_signups", () => HttpResponse.json({ code: "storage_failure", message: "test-only failure" }, { status: 503 })));
  const failed = await POST(request(entrant));
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).id, undefined);
});
