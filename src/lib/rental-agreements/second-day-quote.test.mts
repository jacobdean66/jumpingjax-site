import assert from "node:assert/strict";
import test from "node:test";
import { prepareRentalBooking } from "./prepare-booking";
import { buildRentalAgreementSnapshot } from "./snapshot";
import { SECOND_DAY_QUOTE_NOTE } from "../rentals/second-day-quote";

test("second-day callback requests persist without granting a free day or changing the booked price", async () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const body = { rental_item: "castle", customer_name: "Isolated quote test", customer_email: "test@example.invalid", customer_phone: "8645550100", idempotency_key: "second-day-quote-test", event_date: "2028-12-29", duration: "One Day", event_address: "Test address", event_start_time: "12:00", requested_delivery_window: "10 AM - 1 PM", setup_surface: "Grass", setup_access: "Driveway", payment_method: "Cash", distance_miles: 0, setup_notes: "Please use the side gate." };
    const regular = await prepareRentalBooking(body);
    const requested = await prepareRentalBooking({...body,second_day_quote_requested:true});
    assert.ok(!(regular instanceof Response));
    assert.ok(!(requested instanceof Response));
    assert.equal(requested.input.spanDays,1);
    assert.equal(requested.input.durationLabel,"One Day");
    assert.equal(requested.input.total,regular.input.total);
    assert.equal(requested.input.subtotal,regular.input.subtotal);
    assert.equal(requested.input.delivery_fee,regular.input.delivery_fee);
    assert.ok(requested.input.setup_notes?.includes(SECOND_DAY_QUOTE_NOTE));
    assert.ok(requested.input.setup_notes?.includes("Please use the side gate."));
    assert.ok(!regular.input.setup_notes?.includes(SECOND_DAY_QUOTE_NOTE));
    const snapshot = buildRentalAgreementSnapshot(requested.input,{version:1,title:"Test agreement",terms:"Test terms",updated_at:"2026-10-05",updated_by:"Test"});
    assert.equal(snapshot.setupNotes,requested.input.setup_notes);
    assert.equal(snapshot.spanDays,1);
    const foam = await prepareRentalBooking({...body,rental_item:"foam-party",duration:"1 Hour",second_day_quote_requested:true});
    assert.ok(!(foam instanceof Response));
    assert.ok(!foam.input.setup_notes?.includes(SECOND_DAY_QUOTE_NOTE));
  } finally {
    if(previous===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;
  }
});
