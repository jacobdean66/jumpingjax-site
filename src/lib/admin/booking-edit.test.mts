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
    invitationDeliveryPreference: ["office_pickup", "email"],
    invitationTemplateId: "ticket",
    balloonColors: "Pink/Purple",
    tableClothColors: "White",
    drinkChoice: "Lemonade",
    notes: "Nut allergy",
    paymentMethod: "Card",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.partyTheme, "Unicorns");
  assert.deepEqual(parsed.value.invitationDeliveryPreferences, [
    "office_pickup",
    "email",
  ]);
  assert.equal(parsed.value.invitationTemplateId, "ticket");
  assert.equal(parsed.value.childName, "Sam");
});

test("rental edits accept saved database times and normalize to minutes", () => {
  for (const [eventStartTime, expected] of [
    ["17:00:00", "17:00"],
    ["17:00:00.000000", "17:00"],
    [" 09:15:00 ", "09:15"],
    ["00:00:00", "00:00"],
    ["23:59:59.123456", "23:59"],
    ["17:00", "17:00"],
    ["", null],
    [null, null],
    [undefined, null],
  ] as const) {
    const parsed = parseRentalEditInput({
      customerName: "Jordan Lee",
      eventDate: "2026-10-22",
      eventAddress: "100 Main St",
      paymentMethod: "Card",
      eventStartTime,
      setupNotes: "Updated delivery instructions",
    });
    assert.equal(parsed.ok, true, `Expected ${eventStartTime} to be accepted`);
    if (!parsed.ok) continue;
    assert.equal(parsed.value.eventStartTime, expected);
    assert.equal(parsed.value.setupNotes, "Updated delivery instructions");
  }
});

test("rental edits reject malformed or out-of-range start times", () => {
  for (const eventStartTime of [
    "24:00", "17:60", "17:00:60", "17:00:xx", "17:00:00junk",
    "17:00.5", "17:00:00.", "5:00 PM", "2026-10-22T17:00:00", "17:00:00Z",
  ]) {
    const parsed = parseRentalEditInput({
      customerName: "Jordan Lee",
      eventDate: "2026-10-22",
      eventAddress: "100 Main St",
      paymentMethod: "Card",
      eventStartTime,
    });
    assert.deepEqual(parsed, {
      ok: false,
      error: "Event start time must be HH:MM.",
    }, eventStartTime);
  }
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
