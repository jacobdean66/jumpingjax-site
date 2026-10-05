import assert from "node:assert/strict";
import test from "node:test";
import { RENTALS } from "../../data/rentals";
import { prepareRentalBooking } from "./prepare-booking";
import { buildRentalAgreementSnapshot } from "./snapshot";

test("the server ignores forged prices and applies the offer to the catalog quote and agreement", async () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const rental = RENTALS.find(item => item.categoryId === "bounce-houses")!;
    const body = { rental_items: [{ rental_item: rental.slug, starting_price: 1, promotion_eligible: false }], customer_name: "Test Customer", customer_email: "test@example.invalid", customer_phone: "8645550100", idempotency_key: "promotion-quote-test", event_date: "2026-11-12", duration: "One Day", event_address: "Test address", event_start_time: "12:00", requested_delivery_window: "10 AM – 1 PM", setup_surface: "Grass", setup_access: "Driveway", payment_method: "Cash", distance_miles: 0, subtotal: 1, total: 1, promotion_discount: 99999 };
    const regular = await prepareRentalBooking(body);
    const discounted = await prepareRentalBooking({ ...body, promotion_code: "GOOGLE15" });
    assert.ok(!(regular instanceof Response));
    assert.ok(!(discounted instanceof Response));
    const saving = Math.round(regular.input.subtotal * 15) / 100;
    assert.equal(discounted.input.promotion?.discount, saving);
    assert.equal(discounted.input.total, Math.round((regular.input.total - saving) * 100) / 100);
    assert.equal(discounted.input.delivery_fee, regular.input.delivery_fee);
    assert.match(discounted.input.setup_notes ?? "", /GOOGLE15/);
    const snapshot = buildRentalAgreementSnapshot(discounted.input, { version: 1, title: "Test agreement", terms: "Test terms", updated_at: "2026-10-04", updated_by: "Test" });
    assert.equal(snapshot.total, discounted.input.total);
    assert.match(snapshot.additionalTerms, /15%/);
    const invalid = await prepareRentalBooking({ ...body, promotion_code: "GOOGLE100" });
    assert.ok(!(invalid instanceof Response));
    assert.equal(invalid.input.total, regular.input.total);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});
