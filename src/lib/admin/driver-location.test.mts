import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateDriverLocationInput } from "./driver-location";

const here = fileURLToPath(new URL(".", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, `file://${here}`), "utf8");
}

test("driver location validation accepts bounded fresh coordinates", () => {
  const parsed = validateDriverLocationInput(
    {
      driverId: "driver:casey",
      driverName: "Casey Driver",
      truck: "truck-1",
      workDate: "2026-09-26",
      latitude: 34.1954,
      longitude: -82.1618,
      accuracyMeters: 25,
      speedMetersPerSecond: 4,
      headingDegrees: 180,
      capturedAt: "2026-09-26T14:00:00.000Z",
    },
    new Date("2026-09-26T14:01:00.000Z"),
  );

  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && parsed.value.truck, "truck-1");
  assert.equal(parsed.ok && parsed.value.work_date, "2026-09-26");
});

test("driver location validation rejects invalid coordinates and trucks", () => {
  assert.equal(
    validateDriverLocationInput({
      driverId: "driver:casey",
      driverName: "Casey Driver",
      truck: "truck-3",
      workDate: "2026-09-26",
      latitude: 34,
      longitude: -82,
    }).ok,
    false,
  );
  assert.equal(
    validateDriverLocationInput({
      driverId: "driver:casey",
      driverName: "Casey Driver",
      truck: "truck-1",
      workDate: "2026-09-26",
      latitude: 134,
      longitude: -82,
    }).ok,
    false,
  );
});

test("driver location route is driver-authenticated and not customer-facing", () => {
  const route = read("../../app/api/driver/location/route.ts");
  const tracker = read("../../app/driver/DriverLocationTracker.tsx");
  const workspace = read("../../app/admin/deliveries/RoutePlannerWorkspace.tsx");

  assert.match(route, /verifyDriverAccess\(\)/);
  assert.match(route, /saveDriverLocationSnapshot/);
  assert.doesNotMatch(route, /verifyAdminOwnerAccess/);
  assert.doesNotMatch(tracker, /token=/);
  assert.match(workspace, /Customer pages do not receive these coordinates\./);
});
