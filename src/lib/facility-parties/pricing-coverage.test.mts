import assert from "node:assert/strict";
import test from "node:test";
import { listPrivateSlotDispositions, listPublicSaturdaySlotDispositions } from "./availability";
import { DEFAULT_FACILITY_PRICING, priceFacilityPartyWithConfig } from "./pricing";
import { facilityLocalDateTimeToUtc, facilityDateAndMinutes } from "./zoned-time";
import { FACILITY_BOOKING_HORIZON_END_YMD } from "./booking-horizon";

const configured = {
  ...DEFAULT_FACILITY_PRICING,
  publicRoom10: 140, publicRoom20Weekday: 215, publicRoom20Weekend: 240,
  privateWeekday90: 270, privateWeekday120: 310,
  privateWeekend90: 330, privateWeekend120: 365, privateAny180: 450,
};

test("every offered date, room and duration has the correct configured price through the booking horizon", () => {
  let checkedSlots = 0;
  for (let day = new Date("2026-09-28T12:00:00Z"); day.toISOString().slice(0, 10) <= FACILITY_BOOKING_HORIZON_END_YMD; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay();
    const options = [
      ...(["room-10", "room-20"] as const).map(roomId => ({kind: "public" as const, roomId, duration: 90 as const, slots: listPublicSaturdaySlotDispositions(date, roomId, [])})),
      ...([90, 120, 180] as const).map(duration => ({kind: "private" as const, roomId: "room-20" as const, duration, slots: listPrivateSlotDispositions(date, duration, [])})),
    ];
    for (const option of options) {
      for (const slot of option.slots) {
        const price = priceFacilityPartyWithConfig({partyKind: option.kind, roomId: option.roomId, date, durationMinutes: slot.endMinutes - slot.startMinutes, addonSubtotal: 13.5}, configured);
        const expected = option.kind === "public"
          ? option.roomId === "room-10" ? 140 : weekday <= 4 ? 215 : 240
          : option.duration === 180 ? 450 : weekday >= 1 && weekday <= 4
            ? option.duration === 90 ? 270 : 310
            : option.duration === 90 ? 330 : 365;
        assert.equal(price.missingPrice, null, `${date} ${option.kind} ${option.duration}`);
        assert.equal(price.packagePrice, expected);
        assert.equal(price.subtotal, expected + 13.5);
        assert.equal(price.total, Math.round((price.subtotal + Math.round(price.subtotal * .07 * 100) / 100) * 100) / 100);
        checkedSlots++;
      }
      // First/last windows include midnight boundaries and daylight-saving dates.
      for (const slot of [option.slots[0], option.slots.at(-1)].filter(Boolean)) {
        const start = facilityLocalDateTimeToUtc(date, slot!.startMinutes);
        const end = facilityLocalDateTimeToUtc(date, slot!.endMinutes);
        assert.ok(start && end);
        assert.equal((end.getTime() - start.getTime()) / 60000, option.duration);
        assert.deepEqual(facilityDateAndMinutes(start.toISOString()), {date, minutes: slot!.startMinutes});
      }
    }
  }
  assert.ok(checkedSlots > 20000);
  console.log(`Audited ${checkedSlots} offered facility slots through ${FACILITY_BOOKING_HORIZON_END_YMD}`);
});

test("unsupported public days and private rooms cannot receive misleading prices", () => {
  for (const date of ["2027-01-03", "2027-01-04", "2027-01-05"]) {
    assert.ok(priceFacilityPartyWithConfig({partyKind:"public", roomId:"room-10", date, durationMinutes:90, addonSubtotal:0}, configured).missingPrice);
  }
  assert.ok(priceFacilityPartyWithConfig({partyKind:"private", roomId:"room-10", date:"2027-01-07", durationMinutes:120, addonSubtotal:0}, configured).missingPrice);
});
