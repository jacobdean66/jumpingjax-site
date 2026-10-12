import assert from "node:assert/strict";
import test from "node:test";
import { rentalStepErrors } from "./checkout-validation.ts";
import { prepareRentalBooking } from "../rental-agreements/prepare-booking.ts";

const customer = { customerName: "Rental Test", customerEmail: "test@example.invalid", customerPhone: "8645550100", eventAddress: "123 Test St, Greenwood, SC 29649", distanceMiles: "0", setupSurface: "Grass", setupAccess: "Vehicle can drive to setup area", setupNotes: "", paymentMethod: "Cash" };
test("each step checks its own answers and optional notes do not block progress", () => {
  const onlyContact = {...customer, eventAddress:"", distanceMiles:"", setupSurface:"", setupAccess:"", paymentMethod:""};
  assert.deepEqual(rentalStepErrors(1, onlyContact, "", ""), {});
  assert.deepEqual(Object.keys(rentalStepErrors(2, onlyContact, "", "")), ["eventAddress", "setupSurface", "setupAccess"]);
  assert.deepEqual(Object.keys(rentalStepErrors(3, onlyContact, "", "")), ["eventStartTime", "deliveryTime", "paymentMethod"]);
  for (const step of [1,2,3] as const) assert.deepEqual(rentalStepErrors(step,customer,"10 AM - 1 PM","12:00"),{});
});
test("invalid contact information and an edited or unverified address require correction", () => {
  assert.deepEqual(Object.keys(rentalStepErrors(1,{...customer,customerName:" ",customerEmail:"broken",customerPhone:"123"},"", "")),["customerName","customerEmail","customerPhone"]);
  for (const distanceMiles of ["", "NaN", "-1"]) assert.ok(rentalStepErrors(2,{...customer,distanceMiles},"", "").eventAddress);
  assert.deepEqual(rentalStepErrors(2,customer,"", ""),{});
});
test("server rejects the restored required answers while allowing empty optional notes", async () => {
  const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const body={rental_item:"castle",customer_name:customer.customerName,customer_email:customer.customerEmail,customer_phone:customer.customerPhone,idempotency_key:"guided-checkout-test",event_date:"2028-12-29",duration:"One Day",event_address:customer.eventAddress,event_start_time:"12:00",requested_delivery_window:"10 AM - 1 PM",setup_surface:customer.setupSurface,setup_access:customer.setupAccess,payment_method:"Cash",distance_miles:0};
    assert.ok(!(await prepareRentalBooking(body) instanceof Response));
    for(const field of ["customer_name","customer_email","customer_phone","event_address","event_start_time","requested_delivery_window","setup_surface","setup_access","payment_method"]) {
      const response=await prepareRentalBooking({...body,[field]:""});
      assert.ok(response instanceof Response,field);
      assert.equal(response.status,400,field);
    }
  } finally {
    if(previous===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;
  }
});
