import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bindApprovedFacilityPreview, type ApprovedFacilityPreview } from "./preview-binding";

test("adapter uses saved prices for a new binding and reconstructs exact retries from the saved booking", async (t) => {
  const previousPricingSource = process.env.FACILITY_PRICING_DATABASE_ENABLED;
  process.env.FACILITY_PRICING_DATABASE_ENABLED = "true";
  t.after(() => {
    if (previousPricingSource === undefined) delete process.env.FACILITY_PRICING_DATABASE_ENABLED;
    else process.env.FACILITY_PRICING_DATABASE_ENABLED = previousPricingSource;
  });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-04T15:00:00Z") });
  const bookingId = "5efb225d-20d7-4b77-9bfb-bdc4875316de";
  const approval: ApprovedFacilityPreview = {
    previewId: "36fb225d-20d7-4b77-9bfb-bdc4875316de", requestKey: "fixture-preview-bind-001",
    customerName: "Fixture Parent", email: "fixture@example.test", phone: "864-555-0100",
    room: "room-20", date: "2026-11-21", startMinutes: 840,
    selectionRevision: 3, optionIndex: 1, deliveryPreferences: ["email", "print"], quantity: 20, depositAcknowledged: true,
    childGender: "Girl", drinkChoice: "Capri-Sun", paymentMethod: "Cash", notes: "Please save the blue tablecloth.",
    addons: { customBirthdayBalloons: false, goodieBagsQuantity: 0, cottonCandyPackage: "none" },
    pricingRevision: 12,
    quote: { packagePrice: 240, addonSubtotal: 0, subtotal: 240, tax: 16.8, total: 256.8, taxRate: 0.07 },
  };
  const preview = {
    booking_id: null as string | null, status: "accepted", expires_at: "2026-11-05T15:00:00Z",
    recipient: approval.email, customer_phone: approval.phone, child_name: "Fixture Child", child_age: "8",
    party_theme: "Space", party_date: approval.date, party_time: "2:00 PM - 3:30 PM",
    balloon_colors: "Blue", table_cloth_colors: "Silver",
    confirmed_theme: {
      id: "space", label: "Space", description: "A space design", originalQuery: "Space",
      imageUrl: "https://example.com/space.png", sourceUrl: "https://example.com/source",
      imagePath: "/api/facility/invitations/artwork/" + "a".repeat(64), confirmedAt: "2026-11-04T14:00:00Z",
    },
    selection_revision: 3, selected_option_index: 1, delivery_preferences: ["email", "print"], invitation_quantity: 20,
  };
  let failSettings = false;
  let price = 240;
  let settingsReads = 0;
  let artworkReads = 0;
  let receiptReads = 0;
  const calls: { p_pricing_revision: number | null; p_selection_revision: number; p_booking: Record<string, unknown> }[] = [];
  const mock = {
    from(table: string) {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => {
        if (table === "facility_invitation_previews") return { data: preview, error: null };
        if (table === "facility_pricing_settings") {
          settingsReads++;
          if (failSettings) return { data: null, error: { message: "offline" } };
          return { data: { revision: 12, pricing: {
            publicRoom10: 140, publicRoom20Weekday: 215, publicRoom20Weekend: price,
            privateWeekday90: 270, privateWeekday120: 305, privateWeekend90: 270,
            privateWeekend120: 305, privateAny180: 450, taxRate: 0.07,
          } }, error: null };
        }
        assert.equal(table, "facility_bookings");
        receiptReads++;
        return { data: {
          facility_package_price: 240, addon_subtotal: 0, subtotal: 240,
          tax: 16.8, total: 256.8, pricing_details: { taxRate: 0.07 },
        }, error: null };
      } }) }) };
    },
    storage: { from(bucket: string) {
      return { download: async (path: string) => {
        assert.match(bucket, /^invitation-theme-artwork(?:-preview)?$/);
        assert.equal(path, "a".repeat(64) + ".png");
        artworkReads++;
        return { data: new Blob([Buffer.from("89504e470d0a1a0a", "hex")]), error: null };
      } };
    } },
    rpc: async (name: string, args: (typeof calls)[number]) => {
      assert.equal(name, "bind_facility_invitation_preview_atomic");
      calls.push(args);
      if (calls.length > 1 && JSON.stringify(args.p_booking) !== JSON.stringify(calls[0].p_booking)) {
        return { data: null, error: { message: "preview_binding_conflict" } };
      }
      return { data: bookingId, error: null };
    },
  } as unknown as SupabaseClient;

  await assert.rejects(bindApprovedFacilityPreview(mock, { ...approval, phone: "864-555-0101" }), /preview_binding_mismatch/);
  await assert.rejects(bindApprovedFacilityPreview(mock, { ...approval, deliveryPreferences: ["email"] }), /preview_binding_mismatch/);
  await assert.rejects(bindApprovedFacilityPreview(mock, { ...approval, deliveryPreferences: ["email", "email"] }), /invalid_binding_approval/);
  await assert.rejects(bindApprovedFacilityPreview(mock, { ...approval, selectionRevision: 1 }), /preview_selection_changed/);
  failSettings = true;
  await assert.rejects(bindApprovedFacilityPreview(mock, approval), /pricing_unavailable/);
  failSettings = false;
  await assert.rejects(bindApprovedFacilityPreview(mock, { ...approval, pricingRevision: 11 }), /approved_price_changed/);
  price = 250;
  await assert.rejects(bindApprovedFacilityPreview(mock, approval), /approved_price_changed/);
  assert.equal(calls.length, 0);
  price = 240;
  assert.deepEqual(await bindApprovedFacilityPreview(mock, approval), { bookingId });
  const first = calls[0];
  assert.equal(first.p_pricing_revision, 12);
  assert.equal(first.p_selection_revision, 3);
  assert.equal(first.p_booking.start_time, "2026-11-21T19:00:00.000Z");
  assert.equal(first.p_booking.total, 256.8);
  assert.equal(first.p_booking.invitation_quantity, 20);
  assert.equal(first.p_booking.invitation_delivery_preference, "email,print");
  assert.equal((first.p_booking.invitation as { deliveryPreference: string }).deliveryPreference, "email");
  assert.equal(first.p_booking.customer_name, approval.customerName);
  assert.equal(first.p_booking.parent_name, approval.customerName);
  assert.equal(first.p_booking.child_gender, "Girl");
  assert.equal(first.p_booking.drink_choice, "Capri-Sun");
  assert.equal(first.p_booking.payment_method, "Cash");
  assert.equal(first.p_booking.notes, approval.notes);

  preview.booking_id = bookingId;
  preview.expires_at = "2026-11-03T15:00:00Z";
  failSettings = true;
  const previousSettingsReads = settingsReads;
  const previousArtworkReads = artworkReads;
  assert.deepEqual(await bindApprovedFacilityPreview(mock, approval), { bookingId });
  assert.equal(calls[1].p_pricing_revision, null);
  assert.equal(calls[1].p_selection_revision, 3);
  assert.deepEqual(calls[1].p_booking, calls[0].p_booking);
  await assert.rejects(bindApprovedFacilityPreview(mock, { ...approval, customerName: "Changed" }), /preview_binding_conflict/);
  await assert.rejects(bindApprovedFacilityPreview(mock, { ...approval, quote: { ...approval.quote, total: 1 } }), /approved_price_changed/);
  await assert.rejects(bindApprovedFacilityPreview(mock, { ...approval, notes: "Changed" }), /preview_binding_conflict/);
  assert.equal(calls.length, 4);
  assert.equal(receiptReads, 4);
  assert.equal(settingsReads, previousSettingsReads);
  assert.equal(artworkReads, previousArtworkReads);
});
