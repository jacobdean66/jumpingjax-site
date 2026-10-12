import assert from "node:assert/strict";
import test from "node:test";
import { loadGiveawayPartyLink, loadGiveawayPartyView, saveGiveawayPartyLink } from "./party-store.ts";

test("month links persist independently and use only their own booking's real RSVPs", async context => {
  const vars = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const previous = Object.fromEntries(vars.map(name => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://giveaway-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  const octoberId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const septemberId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const files = new Map<string, string>([["public-settings.json", '{"unchanged":true}']]);
  let bucketExists = false;
  let publicBucket = false;
  let failGuestRead = false;
  let failLinkRead = false;
  const guestQueries: string[] = [];
  const bookingRows = new Map([octoberId, septemberId].map(id => [id, { id, child_name: id === octoberId ? "October Child" : "September Child", customer_name: "Test Parent", readable_date: "2026-11-01", readable_time: "2–3:30 PM", room: "room-20", status: "confirmed" }]));
  context.mock.method(globalThis, "fetch", async (input: string | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    assert.equal(url.hostname, "giveaway-test.supabase.co", "Never contact a live database");
    if (url.pathname === "/storage/v1/bucket/site-settings") return bucketExists ? Response.json({ id: "site-settings", name: "site-settings", public: publicBucket }) : Response.json({ statusCode: "404", message: "Bucket not found" }, { status: 404 });
    if (url.pathname === "/storage/v1/bucket" && req.method === "POST") {
      const body = await req.json();
      assert.equal(body.public, false);
      bucketExists = true;
      return Response.json({ name: "site-settings" });
    }
    if (url.pathname.includes("/site-settings/")) {
      const path = url.pathname.split("/site-settings/")[1];
      if (req.method === "POST") { files.set(path, await req.text()); return Response.json({ Key: path }); }
      if (failLinkRead) return Response.json({ statusCode: "503", message: "Storage unavailable" }, { status: 503 });
      return files.has(path) ? new Response(files.get(path), { headers: { "content-type": "application/json" } }) : Response.json({ statusCode: "404", message: "Object not found" }, { status: 404 });
    }
    assert.equal(req.method, "GET", "Linking must not mutate bookings, guests, payments, or winner status");
    if (url.pathname === "/rest/v1/facility_bookings") return Response.json(bookingRows.get(url.searchParams.get("id")!.replace(/^eq\./, "")) ?? null);
    if (url.pathname === "/rest/v1/facility_party_guests") {
      const bookingId = url.searchParams.get("booking_id")!.replace(/^eq\./, "");
      guestQueries.push(bookingId);
      if (failGuestRead) return Response.json({ message: "Test database outage" }, { status: 503 });
      const rows = bookingId === octoberId ? ["child", "adult_signer"].map((role, index) => ({ id: `guest-${index}`, waiver_submission_id: "private-submission", waiver_participant_id: "private-participant", guest_first_name: index ? "Test Parent" : "Test Child", guest_last_name: "Example", guest_dob: "2020-01-01", participant_role: role, signer_first_name: "Test", signer_last_name: "Parent", waiver_expires_on: "2027-10-31", checked_in_at: index ? "2026-10-31T18:10:00Z" : null, checked_in_by: index ? "Staff" : null, created_at: "2026-10-12T19:00:00Z" })) : [];
      return Response.json(rows);
    }
    throw new Error(`Unexpected test request ${url.pathname}`);
  });
  try {
    assert.equal(await loadGiveawayPartyLink("2026-10"), null);
    assert.equal(bucketExists, false, "Reading an unlinked month has no storage side effect");
    const link = { version: 1 as const, drawMonth: "2026-10", bookingId: octoberId, updatedAt: "2026-10-12T19:00:00Z", updatedBy: "test-owner" };
    await saveGiveawayPartyLink(link);
    await saveGiveawayPartyLink({ ...link, drawMonth: "2026-09", bookingId: septemberId });
    assert.equal((await loadGiveawayPartyLink("2026-10"))?.bookingId, octoberId);
    assert.equal((await loadGiveawayPartyLink("2026-09"))?.bookingId, septemberId);
    assert.equal(files.get("public-settings.json"), '{"unchanged":true}');
    const october = await loadGiveawayPartyView("2026-10");
    assert.deepEqual(october.counts, { rsvps: 2, children: 1, adults: 1, checkedIn: 1 });
    assert.doesNotMatch(JSON.stringify(october.guests), /guest_dob|private-submission|private-participant|waiverExpires|"dob"/);
    const september = await loadGiveawayPartyView("2026-09");
    assert.deepEqual(september.counts, { rsvps: 0, children: 0, adults: 0, checkedIn: 0 });
    assert.deepEqual(guestQueries, [octoberId, septemberId]);
    assert.equal((await loadGiveawayPartyView("2026-08")).counts, null, "No linked party is not a party with zero RSVPs");
    failGuestRead = true;
    await assert.rejects(loadGiveawayPartyView("2026-10"), /Test database outage/);
    failGuestRead = false;
    failLinkRead = true;
    await assert.rejects(loadGiveawayPartyLink("2026-10"), /could not be loaded/);
    failLinkRead = false;
    files.set("giveaway-parties/2026-10.json", '{"corrupt":true}');
    await assert.rejects(loadGiveawayPartyLink("2026-10"), /Invalid saved/);
    publicBucket = true;
    await assert.rejects(saveGiveawayPartyLink(link), /must be private/);
  } finally {
    for (const name of vars) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
  }
});
