import assert from "node:assert/strict";
import { before, after, afterEach } from "node:test";
import test from "node:test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { POST } from "../../app/api/campaigns/backyard-takeover/route";
import { BACKYARD_TRACKING_COOKIE } from "./backyard-tracking";
import { backyardTermsFingerprint, signBackyardVisit } from "./backyard-tracking-security";

const url = "https://backyard-fixture.supabase.co";
const old = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, tracking: process.env.CAMPAIGN_TRACKING_SECRET };
const terms = { rules: "Final official contest rules. ".repeat(10), prize: "One selected inflatable rental with delivery and pickup." };
const settings = { opensAt: new Date(Date.now()-86400000).toISOString(), closesAt: new Date(Date.now()+86400000).toISOString(), announcesOn: new Date(Date.now()+7*86400000).toISOString().slice(0,10), eligibleArea: "Greenwood County", retailValue: "500", rulesConfirmed: true };
let open = true, uploads = 0, saves = 0, last: Record<string, unknown> | null = null;
const server = setupServer(
  http.get(`${url}/rest/v1/campaign_events`, () => HttpResponse.json([{ status: open ? "published" : "draft", event_date: null, offer_text: "One selected inflatable rental with delivery and pickup.", rules_text: "Final official contest rules. ".repeat(10), meta_campaign_id: null, meta_campaign_name: null }])),
  http.get(`${url}/rest/v1/backyard_takeover_settings`, () => HttpResponse.json([{ config: settings }])),
  http.get(`${url}/rest/v1/campaign_event_signups`, () => HttpResponse.json([])),
  http.post(`${url}/rest/v1/campaign_events`, () => new HttpResponse(null, { status: 201 })),
  http.get(`${url}/storage/v1/bucket/backyard-takeover-entries`, () => HttpResponse.json({ id: "backyard-takeover-entries", name: "backyard-takeover-entries", public: false })),
  http.post(`${url}/storage/v1/object/backyard-takeover-entries/*`, () => { uploads++; return HttpResponse.json({ Key: "fixture", Id: randomUUID() }, { status: 200 }); }),
  http.delete(`${url}/storage/v1/object/backyard-takeover-entries`, () => HttpResponse.json([])),
  http.post(`${url}/rest/v1/rpc/submit_backyard_entry`, async ({ request }) => { saves++; last = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: last.p_id, created: true }); }),
);
before(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = url; process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-key"; process.env.CAMPAIGN_TRACKING_SECRET = "unit-test-signing-key"; server.listen({ onUnhandledRequest: "error" }); });
afterEach(() => { open = true; uploads = 0; saves = 0; last = null; server.resetHandlers(); });
after(() => { server.close(); for (const [name,value] of [["NEXT_PUBLIC_SUPABASE_URL",old.url],["SUPABASE_SERVICE_ROLE_KEY",old.key],["CAMPAIGN_TRACKING_SECRET",old.tracking]]) { if (value === undefined) delete process.env[name!]; else process.env[name!] = value; } });

async function request(options: { validPhoto?: boolean; origin?: string; permission?: boolean; staleTerms?: boolean } = {}) {
  const form = new FormData();
  form.set("termsVersion", options.staleTerms ? "old-rules" : backyardTermsFingerprint(terms, settings));
  for (const [key,value] of Object.entries({ name: "Fixture entrant", email: "fixture@example.invalid", city: "Greenwood", zip: "29649", partyIdea: "A backyard birthday with lots of ducks", permission: options.permission === false ? "" : "on", rulesAccepted: "on" })) form.set(key,value);
  const photo = options.validPhoto === false ? Buffer.from("not an image") : await sharp({ create: { width: 24, height: 24, channels: 3, background: "#00aacc" } }).png().toBuffer();
  form.set("photos", new Blob([new Uint8Array(photo)], { type: options.validPhoto === false ? "image/jpeg" : "image/png" }), "backyard.png");
  const visit = randomUUID();
  return { visit, req: new NextRequest("https://jumpingjaxllc.com/api/campaigns/backyard-takeover", { method: "POST", body: form, headers: { Origin: options.origin ?? "https://jumpingjaxllc.com", Cookie: `${BACKYARD_TRACKING_COOKIE}=${signBackyardVisit(visit)}`, "x-forwarded-for": randomUUID(), "user-agent": "Mozilla/5.0 Chrome/131 Safari/537.36" } }) };
}

test("a valid public submission saves decoded private photos and server-controlled entry state", async () => {
  const { req,visit } = await request();
  const response = await POST(req);
  assert.equal(response.status,200);
  const data = await response.json();
  assert.equal(data.created,true); assert.equal(uploads,1); assert.equal(saves,1);
  assert.equal(last?.p_visit_id,visit);
  const details = last?.p_details as { status: string; entryPermission: boolean; marketingConsent: boolean; photos: string[] };
  assert.equal(details.status,"new"); assert.equal(details.entryPermission,true); assert.equal(details.marketingConsent,false); assert.equal(details.photos.length,1);
  assert.doesNotMatch(JSON.stringify(data),/fixture@example|phone|photos|service-key|signing-key/);
});

test("a closed campaign rejects submissions before uploading photos or writing entries", async () => {
  open = false;
  const { req } = await request();
  assert.equal((await POST(req)).status,409); assert.equal(uploads,0); assert.equal(saves,0);
});

test("changed rules require a refresh before photos or entries are stored", async () => {
  assert.equal((await POST((await request({ staleTerms: true })).req)).status,409);
  assert.equal(uploads,0); assert.equal(saves,0);
});

test("cross-origin submissions, missing acknowledgement and disguised images cannot create entries", async () => {
  assert.equal((await POST((await request({ origin: "https://other.invalid" })).req)).status,403);
  assert.equal((await POST((await request({ permission: false })).req)).status,400);
  assert.equal((await POST((await request({ validPhoto: false })).req)).status,400);
  assert.equal(uploads,0); assert.equal(saves,0);
});
