import assert from "node:assert/strict";
import test from "node:test";

const facilityAdminDateModulePath = "./facility-admin-date" + ".ts";
const facilityAdminDateModule = await import(facilityAdminDateModulePath);
const { facilityAdminUtcBoundsForYmdRange } = facilityAdminDateModule;

test("facility admin date range uses America/New_York UTC bounds", () => {
  assert.deepEqual(
    facilityAdminUtcBoundsForYmdRange({
      from: "2026-10-26",
      to: "2026-10-28",
    }),
    {
      start: "2026-10-26T04:00:00.000Z",
      endExclusive: "2026-10-29T04:00:00.000Z",
    },
  );
});

test("facility admin date range follows daylight saving changes", () => {
  assert.deepEqual(
    facilityAdminUtcBoundsForYmdRange({
      from: "2026-12-01",
      to: "2026-12-01",
    }),
    {
      start: "2026-12-01T05:00:00.000Z",
      endExclusive: "2026-12-02T05:00:00.000Z",
    },
  );
});
