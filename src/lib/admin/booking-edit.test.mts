import assert from "node:assert/strict";
import test from "node:test";

import {
  facilityBookingIsEditable,
  parseFacilityEditInput,
  parseRentalEditInput,
  rentalBookingIsEditable,
} from "./booking-edit";

test("approved rentals and confirmed facility parties are editable", () => {
  assert.equal(rentalBookingIsEditable("pending"), true);
  assert.equal(rentalBookingIsEditable("approved"), true);
  assert.equal(rentalBookingIsEditable("cancelled"), false);
  assert.equal(rentalBookingIsEditable("rejected"), false);

  assert.equal(facilityBookingIsEditable("pending"), true);
  assert.equal(facilityBookingIsEditable("confirmed"), true);
  assert.equal(facilityBookingIsEditable("approved"), false);
  assert.equal(facilityBookingIsEditable("rejected"), false);
});

test("rental edit parser accepts approved-booking field updates", () => {
  const parsed = parseRentalEditInput({
    customerName: " Jordan Lee ",
    customerEmail: "jordan@example.com",
    customerPhone: "864-555-0100",
    eventDate: "2026-08-15",
    eventStartTime: "14:30",
    requestedDeliveryWindow: "12:00-2:00",
    eventAddress: "100 Main St, Greenwood, SC",
    setupLocation: "Backyard",
    setupSurface: "Grass",
    setupAccess: "Side gate",
    setupNotes: "Dog in yard",
    paymentMethod: "Cash",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.customerName, "Jordan Lee");
  assert.equal(parsed.value.eventDate, "2026-08-15");
  assert.equal(parsed.value.eventStartTime, "14:30");
});

test("facility edit parser accepts confirmed-party field updates", () => {
  const parsed = parseFacilityEditInput({
    customerName: "Alex Parent",
    email: "alex@example.com",
    phone: "864-555-0199",
    parentName: "Alex Parent",
    childName: "Sam",
    childAge: "7",
    childGender: "Girl",
    partyTheme: "Unicorns",
    balloonColors: "Pink/Purple",
    tableClothColors: "White",
    drinkChoice: "Lemonade",
    notes: "Nut allergy",
    paymentMethod: "Card",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.partyTheme, "Unicorns");
  assert.equal(parsed.value.childName, "Sam");
});

test("rental edit parser rejects invalid dates", () => {
  const parsed = parseRentalEditInput({
    customerName: "Jordan",
    eventDate: "08/15/2026",
    eventAddress: "100 Main",
    paymentMethod: "Cash",
  });
  assert.equal(parsed.ok, false);
});
