import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { FacilityBookingCalendarFields } from "../facility-parties/calendar-description.ts";
import { resolveInvitationSnapshot } from "../facility-parties/invitations/snapshot.ts";
import { buildFullInvitationEmailHtml } from "../facility-parties/invitations/email-html.ts";
import { InvitationArtworkRequiredError } from "../facility-parties/invitations/artwork-policy.ts";
import { buildFacilityDecisionEmail } from "./facility-decision-email.ts";
import { sendDurableBookingEmail } from "./durable-email.ts";

const siteUrl = "https://example.invalid";
const booking: FacilityBookingCalendarFields = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", customer_name: "Test Parent", email: "parent@example.invalid",
  phone: "8645550100", parent_name: null, child_name: "Test Child", child_gender: null, child_age: null,
  party_theme: "Halloween Costume Party", invitation: null, balloon_colors: null, table_cloth_colors: null,
  drink_choice: null, payment_method: null, deposit_acknowledged: false, party_label: "Public Play Party",
  room: "room-20", readable_date: "2026-10-31", readable_time: "2:00 PM - 3:30 PM",
  start_time: "2026-10-31T14:00:00-04:00", end_time: "2026-10-31T15:30:00-04:00", notes: null,
  addon_selections: null, facility_package_price: 240, addon_subtotal: 0, subtotal: 0, tax: 0, total: 0,
  pricing_details: { taxRate: 0.07 }, google_calendar_event_id: null, google_calendar_secondary_event_id: null,
};

test("unapproved Halloween artwork cannot block a free party confirmation", () => {
  const snapshot = resolveInvitationSnapshot({ partyTheme: booking.party_theme, stored: booking.invitation });
  assert.throws(() => buildFullInvitationEmailHtml({ snapshot, siteUrl, plainText: "Confirmed" }), InvitationArtworkRequiredError);
  const email = buildFacilityDecisionEmail(booking, "confirm", siteUrl);
  assert.match(email.text, /has been confirmed/);
  assert.match(email.text, /2026-10-31/);
  assert.match(email.text, /2:00 PM - 3:30 PM/);
  assert.match(email.text, /Room: 20 kid party room/);
  assert.match(email.text, /This party is free\. No deposit or payment is due\./);
  assert.match(email.text, /Price adjustment: \$-240\.00/);
  assert.match(email.text, /Total price: \$0\.00/);
  assert.doesNotMatch(email.text, /\$50 due|Printable invitations/);
  const rsvp = `${siteUrl}/facility-party-check-in?booking=${booking.id}&date=2026-10-31`;
  assert.ok(email.text.includes(rsvp));
  assert.ok(email.html.includes(rsvp.replaceAll("&", "&amp;")));
  assert.doesNotMatch(email.html, /data-full-page-invitation|<img/);
});

test("invalid stored theme selection is preserved while the receipt remains deliverable", () => {
  const stored = { confirmedTheme: { label: "Invalid" }, marker: "saved-selection" };
  const email = buildFacilityDecisionEmail({ ...booking, invitation: stored }, "confirm", siteUrl);
  assert.match(email.html, /has been confirmed/);
  assert.deepEqual(stored, { confirmedTheme: { label: "Invalid" }, marker: "saved-selection" });
});

test("approved artwork remains included and a paid party keeps its deposit instructions", () => {
  const email = buildFacilityDecisionEmail({ ...booking, party_theme: "Sonic", subtotal: 240, tax: 16.8, total: 256.8 }, "confirm", siteUrl);
  assert.match(email.html, /data-full-page-invitation="true"/);
  assert.match(email.html, /invitations\/approved\/sonic\/card\.png/);
  assert.match(email.text, /Deposit: \$50 due/);
  assert.match(email.text, /Total price: \$256\.80/);
  assert.doesNotMatch(email.text, /This party is free/);
});

test("legacy missing totals are not described as free and customer text is escaped", () => {
  const email = buildFacilityDecisionEmail({ ...booking, total: null, customer_name: '<script>alert("x")</script>' }, "confirm", siteUrl);
  assert.doesNotMatch(email.text, /This party is free/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
});

test("rejection has no RSVP or confirmed-party invitation", () => {
  const email = buildFacilityDecisionEmail(booking, "reject", siteUrl);
  assert.match(email.text, /unable to confirm/);
  assert.doesNotMatch(email.text + email.html, /RSVP|facility-party-check-in|data-full-page-invitation|No deposit/);
});

test("confirmation retry requires staff auth and a confirmed booking, with no booking or payment mutation", () => {
  const route = readFileSync(new URL("../../app/api/admin/facility/[id]/confirmation-email/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("verifyAdminAccess();") < route.indexOf("createServiceRoleClient();"));
  assert.match(route, /booking\.status !== "confirmed"/);
  assert.match(route, /messageKey: `facility-\$\{id\}-decision-confirm-v1`/);
  assert.doesNotMatch(route, /\.update\(|\.insert\(|(?:create|sync|delete)GoogleCalendar|payment_entries|\.delete\(/);
});

test("failed durable email retries once with the same provider key, then suppresses duplicates", async context => {
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_test_only";
  let row: Record<string, unknown> | null = null;
  let providerAttempts = 0;
  context.mock.method(console, "error", () => {});
  context.mock.method(globalThis, "fetch", async (input: string | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "api.resend.com") {
      providerAttempts++;
      assert.equal(request.headers.get("idempotency-key"), `facility-${booking.id}-decision-confirm-v1`);
      const body = await request.json();
      assert.match(body.text, /No deposit or payment is due/);
      return providerAttempts === 1
        ? Response.json({ name: "application_error", message: "test outage" }, { status: 500 })
        : Response.json({ id: "test-provider-id" });
    }
    assert.equal(url.hostname, "email-test.supabase.co", "No live network traffic allowed");
    assert.equal(url.pathname, "/rest/v1/booking_notification_outbox");
    if (request.method === "POST") { row ??= { ...await request.json(), status: "pending", attempt_count: 0 }; return new Response(null, { status: 201 }); }
    if (request.method === "PATCH") { Object.assign(row!, await request.json()); return new Response(null, { status: 204 }); }
    return Response.json(row);
  });
  try {
    const supabase = createClient("https://email-test.supabase.co", "test-only-key", { auth: { persistSession: false } });
    const input = { supabase, messageKey: `facility-${booking.id}-decision-confirm-v1`, kind: "facility" as const, bookingId: booking.id, purpose: "decision_confirm", to: booking.email!, ...buildFacilityDecisionEmail(booking, "confirm", siteUrl) };
    assert.ok((await sendDurableBookingEmail(input)).error);
    assert.equal((await sendDurableBookingEmail(input)).error, null);
    assert.equal((await sendDurableBookingEmail(input)).alreadySent, true);
    assert.equal(providerAttempts, 2);
    assert.equal(row!.status, "sent");
  } finally {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
  }
});
