import assert from "node:assert/strict";
import test from "node:test";

import {
  addCalendarMonthsClamped,
  birthdayDateForYear,
  nextBirthdayCouponSchedule,
} from "./date";
import {
  birthdayCouponIdentityKey,
} from "./service";
import {
  birthdayCouponSubject,
  birthdayCouponText,
} from "./email";

test("calculates birthday coupon send date one calendar month before birthday", () => {
  assert.deepEqual(nextBirthdayCouponSchedule("2018-09-20", "2026-08-20"), {
    birthdayYear: 2026,
    birthdayDate: "2026-09-20",
    sendOn: "2026-08-20",
  });
});

test("rolls to next year when this year's birthday already passed", () => {
  assert.deepEqual(nextBirthdayCouponSchedule("2018-08-19", "2026-08-20"), {
    birthdayYear: 2027,
    birthdayDate: "2027-08-19",
    sendOn: "2027-07-19",
  });
});

test("uses Feb 28 for leap-day birthdays in non-leap years", () => {
  assert.equal(birthdayDateForYear("2020-02-29", 2027), "2027-02-28");
  assert.deepEqual(nextBirthdayCouponSchedule("2020-02-29", "2027-01-28"), {
    birthdayYear: 2027,
    birthdayDate: "2027-02-28",
    sendOn: "2027-01-28",
  });
});

test("keeps Feb 29 for leap-day birthdays in leap years", () => {
  assert.equal(birthdayDateForYear("2020-02-29", 2028), "2028-02-29");
  assert.equal(addCalendarMonthsClamped("2028-02-29", -1), "2028-01-29");
});

test("clamps one-month date math at month ends", () => {
  assert.equal(addCalendarMonthsClamped("2026-03-31", -1), "2026-02-28");
  assert.equal(addCalendarMonthsClamped("2028-03-31", -1), "2028-02-29");
  assert.equal(addCalendarMonthsClamped("2027-01-31", -1), "2026-12-31");
});

test("birthday coupon email includes required offer and practical redemption", () => {
  const subject = birthdayCouponSubject({ childFirstName: "Ava" });
  const text = birthdayCouponText({
    childFirstName: "Ava",
    siteUrl: "https://example.com",
  });

  assert.equal(subject, "Ava's birthday is coming up");
  assert.match(text, /20% off a birthday party at Jumping Jax/);
  assert.match(text, /reply to this email or call Jumping Jax/i);
  assert.match(text, /mention this email when booking/i);
  assert.match(text, /https:\/\/example\.com\/facility-parties/);
});

test("child identity key deduplicates casing and whitespace variations", () => {
  const first = birthdayCouponIdentityKey({
    signerEmail: " Parent@Example.com ",
    childFirstName: " Ava ",
    childLastName: " Stone",
    childDob: "2018-09-20",
  });
  const second = birthdayCouponIdentityKey({
    signerEmail: "parent@example.com",
    childFirstName: "ava",
    childLastName: "stone",
    childDob: "2018-09-20",
  });

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});
