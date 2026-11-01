import assert from "node:assert/strict";
import test from "node:test";
import { rentalStepErrors } from "./checkout-validation.ts";
import { prepareRentalBooking } from "../rental-agreements/prepare-booking.ts";

const customer = { customerName: "Rental Test", customerEmail: "test@example.invalid", customerPhone: "8645550100", eventAddress: "123 Test St, Greenwood, SC 29649", distanceMiles: "0", setupSurface: "Grass", setupAccess: "Vehicle can drive to setup area", setupNotes: "No additional notes", paymentMethod: "Cash" };
test("each step checks its own answers", () => {
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
test("server requires contact information and explicit operational answers", async () => {
  const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const body={rental_item:"castle",customer_name:customer.customerName,customer_email:customer.customerEmail,customer_phone:customer.customerPhone,idempotency_key:"guided-checkout-test",event_date:"2028-12-29",duration:"One Day",event_address:customer.eventAddress,event_start_time:"12:00",requested_delivery_window:"10 AM - 1 PM",setup_surface:customer.setupSurface,setup_access:customer.setupAccess,payment_method:"Cash",setup_notes:"No additional notes",distance_miles:0};
    assert.ok(!(await prepareRentalBooking(body) instanceof Response));
    for(const field of ["customer_name","customer_email","customer_phone","event_address","event_start_time","requested_delivery_window","setup_surface","setup_access","setup_notes","payment_method"]) {
      const response=await prepareRentalBooking({...body,[field]:""});
      assert.ok(response instanceof Response,field);
      assert.equal(response.status,400,field);
    }
  } finally {
    if(previous===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;
  }
});

test("deferred rental preferences preserve the quote without inventing a start time", async () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const pending = { ...customer, setupSurface: "Decide later", setupAccess: "Decide later", setupNotes: "Decide later", paymentMethod: "Decide later" };
    for (const step of [1, 2, 3] as const) assert.deepEqual(rentalStepErrors(step, pending, "Decide later", "Decide later"), {});
    assert.ok(rentalStepErrors(2, { ...pending, setupNotes: "" }, "Decide later", "Decide later").setupNotes);
    const body = { rental_item: "castle", customer_name: customer.customerName, customer_email: customer.customerEmail, customer_phone: customer.customerPhone, event_address: customer.eventAddress, idempotency_key: "deferred-preference-test", event_date: "2028-12-29", duration: "One Day", distance_miles: 0, event_start_time: "Decide later", requested_delivery_window: "Decide later", setup_surface: "Decide later", setup_access: "Decide later", setup_notes: "Decide later", payment_method: "Decide later" };
    const result = await prepareRentalBooking(body);
    assert.ok(!(result instanceof Response));
    assert.equal(result.input.event_start_time, undefined);
    assert.equal(result.input.requested_delivery_window, "Decide later");
    assert.equal(result.input.payment_method, "Decide later");
    for (const key of ["customer_email", "customer_phone"] as const) assert.ok(await prepareRentalBooking({ ...body, [key]: "Decide later" }) instanceof Response);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});
