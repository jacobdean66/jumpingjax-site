import assert from "node:assert/strict";
import test from "node:test";

import { facilityDateAndMinutes, facilityLocalDateTimeToUtc } from "./zoned-time";

test("New York business time is independent of the process/browser timezone", () => {
  const instant = facilityLocalDateTimeToUtc("2026-07-19", 18 * 60 + 30);
  assert.equal(instant?.toISOString(), "2026-07-19T22:30:00.000Z");
  assert.deepEqual(facilityDateAndMinutes(instant!.toISOString()), {
    date: "2026-07-19",
    minutes: 18 * 60 + 30,
  });
});

test("spring DST gap is rejected and valid edge times retain their wall clock", () => {
  assert.equal(facilityLocalDateTimeToUtc("2026-03-08", 2 * 60 + 30), null);
  assert.equal(
    facilityLocalDateTimeToUtc("2026-03-08", 1 * 60 + 30)?.toISOString(),
    "2026-03-08T06:30:00.000Z",
  );
  assert.equal(
    facilityLocalDateTimeToUtc("2026-03-08", 3 * 60 + 30)?.toISOString(),
    "2026-03-08T07:30:00.000Z",
  );
});

test("fall DST conversion round-trips a valid New York wall time", () => {
  const instant = facilityLocalDateTimeToUtc("2026-11-01", 1 * 60 + 30);
  assert.deepEqual(facilityDateAndMinutes(instant!.toISOString()), {
    date: "2026-11-01",
    minutes: 90,
  });
});
