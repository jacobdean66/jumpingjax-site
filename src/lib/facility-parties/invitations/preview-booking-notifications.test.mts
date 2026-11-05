import assert from "node:assert/strict";
import test from "node:test";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { deliverSavedPreviewBookingNotifications } from "./preview-booking-notifications";
import { invitationSnapshotFromChoice } from "./snapshot";

test("notification dispatch uses the claimed saved booking and the website outbox identities", async t => {
  const previewId = "36fb225d-20d7-4b77-9bfb-bdc4875316de";
  const bookingId = "5efb225d-20d7-4b77-9bfb-bdc4875316de";
  const env = {
    RECEPTIONIST_INVITATION_PREVIEW_ENABLED: "false",
    RESEND_API_KEY: "synthetic-not-a-resend-key",
    RESEND_FROM_EMAIL: "Jumping Jax <parties@example.test>",
    NEXT_PUBLIC_SUPABASE_URL: "https://facility-mail-fixture.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic",
    APPROVAL_TOKEN_SECRET: "synthetic-approval-secret-only-in-test",
  };
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }

  const snapshot = invitationSnapshotFromChoice("Space", 1, 0, "Blue", {
    id: "fixture-theme", label: "Space", description: "Space art",
    imageUrl: "https://example.com/art.png", sourceUrl: "https://example.com/art",
    imagePath: "/api/facility/invitations/artwork/" + "a".repeat(64),
    originalQuery: "Space", confirmedAt: "2026-11-05T02:00:00Z",
  });
  const booking = {
    customer_name: "Saved Parent", email: "saved-customer@example.test", phone: "864-555-0100",
    child_name: "Saved Child", child_gender: "", child_age: "8", party_theme: "Space",
    balloon_colors: "Blue", table_cloth_colors: "", drink_choice: "Soda", payment_method: "Cash",
    deposit_acknowledged: true, notes: "Saved notes", party_kind: "public", room: "room-20",
    start_time: "2027-01-02T19:00:00+00:00", end_time: "2027-01-02T20:30:00+00:00",
    readable_date: "2027-01-02", readable_time: "2:00 PM - 3:30 PM", party_label: "Public Play Party",
    addon_selections: null, facility_package_price: 240, addon_subtotal: 0, subtotal: 240, tax: 16.8,
    total: 256.8, tax_rate: 0.07, invitation: snapshot, invitation_delivery_preference: "email,print",
    invitation_quantity: 20, preview_option_index: 1,
  };
  const owner = "saved-owner@example.test";
  const outbox = new Map<string, Record<string, unknown>>();
  const providerRequests: { key: string | null; body: Record<string, unknown> }[] = [];
  const outcomes: Record<string, unknown>[] = [];
  let mode = "pending", calls = 0, released = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls++;
    if (url.origin === "https://api.resend.com" && url.pathname === "/emails") {
      providerRequests.push({ key: new Headers(init?.headers).get("idempotency-key"), body: JSON.parse(String(init?.body)) });
      return Response.json({ id: "synthetic-accepted" });
    }
    assert.equal(url.origin, "https://facility-mail-fixture.invalid");
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname === "/rest/v1/rpc/claim_facility_preview_notifications") {
      assert.equal(body.p_preview_id, previewId);
      assert.equal(body.p_booking_id, bookingId);
      assert.ok(body.p_lease_id);
      return Response.json(mode === "claimed" ? { status: mode, owners: [owner], booking } : { status: mode });
    }
    if (url.pathname === "/rest/v1/booking_integration_workflows") {
      assert.equal(body.booking_id, bookingId);
      return new Response(null, { status: 201 });
    }
    if (url.pathname === "/rest/v1/rpc/record_booking_workflow_outcome") {
      outcomes.push(body);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/facility_invitation_previews") {
      assert.equal(init?.method, "PATCH");
      assert.equal(url.searchParams.get("id"), "eq." + previewId);
      assert.equal(url.searchParams.get("booking_id"), "eq." + bookingId);
      assert.match(url.searchParams.get("notification_lease_id") ?? "", /^eq\./);
      assert.deepEqual(body, { notification_lease_id: null, notification_lease_until: null });
      released++;
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/booking_notification_outbox") {
      if (init?.method === "POST") {
        if (!outbox.has(body.message_key)) outbox.set(body.message_key, { ...body, status: "pending", attempt_count: 0 });
        return new Response(null, { status: 201 });
      }
      const key = url.searchParams.get("message_key")!.slice(3);
      const message = outbox.get(key)!;
      assert.ok(message);
      if (init?.method === "PATCH") {
        Object.assign(message, body);
        return new Response(null, { status: 204 });
      }
      return Response.json(message);
    }
    throw new Error("Unexpected fixture request");
  });

  const db = createServiceRoleClient();
  assert.deepEqual(await deliverSavedPreviewBookingNotifications(db, previewId, bookingId), { status: "disabled" });
  assert.equal(calls, 0);
  process.env.RECEPTIONIST_INVITATION_PREVIEW_ENABLED = "true";
  assert.deepEqual(await deliverSavedPreviewBookingNotifications(db, previewId, bookingId), { status: "pending" });
  assert.equal(providerRequests.length, 0);

  mode = "claimed";
  assert.deepEqual(await deliverSavedPreviewBookingNotifications(db, previewId, bookingId), {
    status: "provider-accepted", customerReceiptAccepted: true, ownerNotificationAccepted: true,
  });
  assert.deepEqual(providerRequests.map(request => request.key), [
    `facility-${bookingId}-owner-${owner}-v1`, `facility-${bookingId}-customer-receipt-v1`,
  ]);
  assert.equal(providerRequests[0].body.to, owner);
  assert.equal(providerRequests[1].body.to, booking.email);
  assert.match(String(providerRequests[1].body.text), /Saved Parent/);
  assert.match(String(providerRequests[1].body.text), /Invitation design: Portrait/);
  assert.match(String(providerRequests[1].body.text), /\$256\.80/);
  assert.match(String(providerRequests[1].body.text), /waiting for confirmation/);
  assert.deepEqual(outcomes.map(outcome => [outcome.p_step, outcome.p_outcome]), [
    ["initial_customer_email", "sent"], ["owner_notification", "sent"],
  ]);
  assert.equal(released, 1);

  mode = "provider-accepted";
  assert.equal((await deliverSavedPreviewBookingNotifications(db, previewId, bookingId)).status, "provider-accepted");
  assert.equal(providerRequests.length, 2);
});
