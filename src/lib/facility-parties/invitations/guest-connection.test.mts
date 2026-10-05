import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import { PartyInvitationCard } from "../../../components/facility-parties/PartyInvitationCard.tsx";
import { InvitationSheet } from "../../../components/facility-parties/InvitationSheet.tsx";
import { buildFullInvitationEmailHtml } from "./email-html.ts";
import { buildEditableInvitationPptx } from "./editable-pptx.ts";
import { invitationSnapshotFromChoice } from "./snapshot.ts";
import { buildFacilityWaiverInvitationUrl } from "../invitations.ts";
import { loadFacilityInvitationView } from "./load-invitation.ts";
import { POST, GET } from "../../../app/api/facility-party/check-in/route.ts";
import { POST as completeWaiver } from "../../../app/api/facility-party/check-in/complete/route.ts";

const partyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const partyB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const participantId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const waiverUrl = buildFacilityWaiverInvitationUrl({ bookingId: partyA, partyDate: "2027-02-14" });
const details = { childName: "Birthday Test", childAge: "7", dateLabel: "February 14, 2027", timeLabel: "2–4 PM" };
const confirmed = { id: "confirmed", label: "Rumi — KPop Demon Hunters", description: "Confirmed character", originalQuery: "Kpop", imageUrl: "https://images.example.com/rumi.png", sourceUrl: "https://example.com/movie", imagePath: `/api/facility/invitations/artwork/${"a".repeat(64)}`, confirmedAt: "2026-09-28T12:00:00.000Z" };

function assertQrTargets(html: string, count: number, expected: string) {
  const tags = html.match(/<img\b[^>]*data-invitation-qr="true"[^>]*>/g) ?? [];
  assert.equal(tags.length, count);
  for (const tag of tags) {
    const src = tag.match(/src="([^"]*)"/)?.[1].replaceAll("&amp;", "&");
    assert.ok(src);
    assert.equal(new URL(src).searchParams.get("data"), expected);
  }
}

test("every approved/confirmed layout and every printed card uses its own party QR, overriding stale supplied images", () => {
  for (const label of ["Princess", "Cars", "Dinosaur", "Sonic", confirmed.label]) {
    for (let option = 0; option < 4; option += 1) {
      const snapshot = invitationSnapshotFromChoice(label, option, option, "", label === "Sonic" ? undefined : { ...confirmed, label });
      const props = { snapshot, ...details, waiverUrl, qrUrl: "https://wrong.example.com/qr.png" };
      const card = renderToStaticMarkup(React.createElement(PartyInvitationCard, props));
      assertQrTargets(card, 1, waiverUrl);
      assert.ok(card.includes(`href="${waiverUrl.replaceAll("&", "&amp;")}"`));
      assertQrTargets(renderToStaticMarkup(React.createElement(InvitationSheet, { ...props, invitationQuantity: 8 })), 8, waiverUrl);
      assertQrTargets(buildFullInvitationEmailHtml({ ...props, siteUrl: "https://jumpingjaxllc.com", plainText: "Test" }), 1, waiverUrl);
    }
  }
  for (const label of ["Princess", "Cars"]) {
    const snapshot = invitationSnapshotFromChoice(label, 0, 0, "", { ...confirmed, label });
    const sheet = renderToStaticMarkup(React.createElement(InvitationSheet, { snapshot, ...details, waiverUrl, invitationQuantity: 4 }));
    assertQrTargets(sheet, 4, waiverUrl);
    assert.match(sheet, /data-print-layout="letter-landscape-full-page"/);
  }
});

test("editable invitation embeds and links each party QR and refuses a download when the QR is unavailable", async context => {
  const image = await readFile("public/invitation-library/themes/princess-royal/princess.png");
  let fail = false;
  context.mock.method(globalThis, "fetch", async (source: string) => {
    assert.equal(new URL(source).searchParams.get("data"), waiverUrl);
    return fail ? new Response("Unavailable", { status: 503 }) : new Response(image, { headers: { "content-type": "image/png" } });
  });
  const input = { snapshot: invitationSnapshotFromChoice("Sonic"), ...details, waiverUrl, qrUrl: "https://wrong.example.com/qr.png", invitationQuantity: 8 };
  const zip = await JSZip.loadAsync(await buildEditableInvitationPptx(input));
  for (const page of [1, 2]) {
    const xml = await zip.file(`ppt/slides/slide${page}.xml`)!.async("text");
    assert.equal((xml.match(/Party check-in and guest list QR code/g) ?? []).length, 4);
    const rels = await zip.file(`ppt/slides/_rels/slide${page}.xml.rels`)!.async("text");
    assert.ok(rels.includes(waiverUrl.replaceAll("&", "&amp;")), rels);
  }
  fail = true;
  await assert.rejects(buildEditableInvitationPptx(input), /party QR code could not be loaded/);
});

test("QR destination, RSVP, arrival and public guest list remain scoped to the same booking", async context => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://guest-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  const guests = new Map<string, Record<string, unknown>>();
  let rejected = false;
  let expiredWaiver = false;
  let writes = 0;
  const participant = { id: participantId, submission_id: "submission", first_name: "Ava", last_name: "Smith", dob: "2018-01-02", role: "child", waiver_submissions: { id: "submission", status: "completed", signer_first_name: "Pat", signer_last_name: "Smith", expires_on: "2029-12-31", signed_at: "2026-09-28T12:00:00Z" } };
  context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
    const request = new Request(source, init);
    const url = new URL(request.url);
    assert.equal(url.hostname, "guest-test.supabase.co", "No live database traffic is allowed");
    const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
    const id = url.searchParams.get("booking_id")?.replace(/^eq\./, "") ?? "";
    if (url.pathname.endsWith("/rpc/get_waiver_completion_by_token_hash")) return json({ outcome: "ok", submission_id: "submission", expires_on: expiredWaiver ? "2020-01-01" : "2029-12-31", status: "completed", participant_count: 1 });
    if (url.pathname.endsWith("/facility_bookings")) {
      const booking = url.searchParams.get("id")?.replace(/^eq\./, "");
      assert.ok([partyA, partyB].includes(booking!));
      return json({ id: booking, status: rejected ? "cancelled" : "confirmed", readable_date: "2027-02-14", readable_time: "2–4 PM", child_name: "Birthday Test", child_age: "7", party_label: "Private Party", party_theme: "Sonic", invitation: null, invitation_quantity: 4 });
    }
    if (url.pathname.endsWith("/waiver_participants")) return json([participant]);
    if (url.pathname.endsWith("/facility_party_guests")) {
      if (request.method === "POST") {
        const body = await request.json();
        assert.equal(url.searchParams.get("on_conflict"), "booking_id,waiver_participant_id");
        assert.equal(body.booking_id, partyA);
        assert.equal("checked_in_at" in body, false, "RSVP must not reset arrival status");
        const row = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", checked_in_at: null, checked_in_by: null, created_at: "2026-09-28T12:00:00Z", ...guests.get(partyA), ...body };
        guests.set(partyA, row); writes += 1;
        return json(row);
      }
      if (request.method === "PATCH") {
        assert.equal(id, partyA);
        assert.equal(url.searchParams.get("id"), "eq.dddddddd-dddd-4ddd-8ddd-dddddddddddd");
        const row = { ...guests.get(id), ...await request.json() };
        guests.set(id, row); writes += 1;
        return json(row);
      }
      return json(guests.has(id) ? [guests.get(id)] : []);
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  const post = (mode: string) => POST(new Request("https://example.com/api/facility-party/check-in", { method: "POST", body: JSON.stringify({ mode, bookingId: partyA, firstName: "Ava", lastName: "Smith", participantId, partyDate: "wrong stale date" }) }));
  let cookie = "";
  const list = async (id: string) => (await GET(new Request(`https://example.com/api/facility-party/check-in?bookingId=${id}`, { headers: { cookie } }))).json();
  try {
    for (const id of [partyA, partyB]) {
      const view = await loadFacilityInvitationView(id);
      assert.ok(view);
      const qrTarget = new URL(view.qrUrl).searchParams.get("data")!;
      assert.equal(qrTarget, view.waiverUrl);
      assert.equal(new URL(qrTarget).searchParams.get("booking"), id);
    }
    const rsvpResponse = await post("rsvp");
    cookie = rsvpResponse.headers.get("set-cookie")!.split(";")[0];
    const rsvp = await rsvpResponse.json();
    assert.equal(rsvp.registered, true);
    assert.equal(rsvp.checkedIn, false);
    assert.equal(rsvp.partyDate, "2027-02-14");
    assert.equal((await list(partyA)).party.expectedGuests[0].displayName, "Ava S.");
    assert.equal((await list(partyB)).party.expectedGuests.length, 0);
    await post("rsvp");
    assert.equal(guests.size, 1, "Repeated RSVP must not duplicate the guest");
    assert.equal((await (await post("check-in")).json()).checkedIn, true);
    const arrived = (await list(partyA)).party;
    assert.equal(arrived.expectedGuests.length, 0);
    assert.equal(arrived.checkedInGuests.length, 1);
    assert.equal((await list(partyB)).party.checkedInGuests.length, 0);
    assert.doesNotMatch(JSON.stringify(arrived), /2018-01-02|Smith|submission|waiver_participant/);
    guests.clear();
    const complete = (atFacility: boolean) => completeWaiver(new Request("https://example.com/api/facility-party/check-in/complete", { method: "POST", body: JSON.stringify({ bookingId: partyA, publicToken: "test-waiver-token-longer-than-32-characters", atFacility, partyDate: "wrong stale date" }) }));
    const signedResponse = await complete(false);
    cookie = signedResponse.headers.get("set-cookie")!.split(";")[0];
    const signed = await signedResponse.json();
    assert.match(signed.message, /on the guest list/);
    assert.equal(signed.partyDate, "2027-02-14");
    assert.equal((await list(partyA)).party.expectedGuests.length, 1);
    await complete(false);
    assert.equal(guests.size, 1);
    assert.match((await (await complete(true)).json()).message, /checked in/);
    assert.equal((await list(partyA)).party.checkedInGuests.length, 1);
    assert.equal((await list(partyB)).party.checkedInGuests.length, 0);
    expiredWaiver = true;
    const before = writes;
    assert.equal((await complete(false)).status, 404);
    assert.equal(writes, before);
    rejected = true;
    assert.equal((await post("rsvp")).status, 404);
    assert.equal(writes, before);
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
