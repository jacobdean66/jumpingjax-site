import assert from "node:assert/strict";
import test from "node:test";

import {
  businessDayWindow,
  businessDayYmdFromInstant,
  isInstantInBusinessDay,
  nyLocalDateTimeToUtc,
} from "./business-day";

test("ordinary midnight boundary starts the business day", () => {
  const window = businessDayWindow("2026-08-03");
  assert.equal(window.startInclusive.toISOString(), "2026-08-03T04:00:00.000Z");
  assert.equal(window.endExclusive.toISOString(), "2026-08-04T04:00:00.000Z");
});

test("11:59:59 p.m. belongs to the same business day", () => {
  const instant = nyLocalDateTimeToUtc("2026-08-03", 23, 59, 59);
  assert.ok(instant);
  assert.equal(businessDayYmdFromInstant(instant!), "2026-08-03");
  assert.equal(isInstantInBusinessDay(instant!, "2026-08-03"), true);
  assert.equal(isInstantInBusinessDay(instant!, "2026-08-04"), false);
});

test("12:00:00 a.m. belongs to the new business day", () => {
  const instant = nyLocalDateTimeToUtc("2026-08-04", 0, 0, 0);
  assert.ok(instant);
  assert.equal(businessDayYmdFromInstant(instant!), "2026-08-04");
  assert.equal(isInstantInBusinessDay(instant!, "2026-08-03"), false);
});

test("spring daylight-saving transition still resolves local midnight windows", () => {
  // 2026-03-08: clocks spring forward 2:00 -> 3:00
  const window = businessDayWindow("2026-03-08");
  assert.equal(window.startInclusive.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(window.endExclusive.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal(nyLocalDateTimeToUtc("2026-03-08", 2, 30, 0), null);
});

test("fall daylight-saving transition still resolves local midnight windows", () => {
  // 2026-11-01: clocks fall back 2:00 -> 1:00
  const window = businessDayWindow("2026-11-01");
  assert.equal(window.startInclusive.toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(window.endExclusive.toISOString(), "2026-11-02T05:00:00.000Z");
  const oneThirty = nyLocalDateTimeToUtc("2026-11-01", 1, 30, 0);
  assert.ok(oneThirty);
  assert.equal(businessDayYmdFromInstant(oneThirty!), "2026-11-01");
});
