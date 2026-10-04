import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { combineDriverLocationSnapshots, validateDriverLocationInput, type DriverLocationSnapshot, type DriverMobileLocationSnapshot } from "./driver-location";

const here = fileURLToPath(new URL(".", import.meta.url));

test("owner location feed includes the latest browser point and preserves native sessions", () => {
  const older: DriverLocationSnapshot = {
    id: "older", driverId: "driver:casey", driverName: "Casey Driver",
    truck: "truck-1", workDate: "2026-10-04", latitude: 34, longitude: -82,
    accuracyMeters: 20, speedMetersPerSecond: null, headingDegrees: null,
    capturedAt: "2026-10-04T20:00:00.000Z", createdAt: "2026-10-04T20:00:01.000Z",
  };
  const latest = { ...older, id: "latest", latitude: 35, capturedAt: "2026-10-04T20:03:00.000Z", createdAt: "2026-10-04T20:03:01.000Z" };
  const mobile: DriverMobileLocationSnapshot = {
    sessionId: "native-session", driverId: "driver:other", driverName: "Other Driver",
    deviceLabel: "Android", startedAt: older.createdAt, lastSeenAt: latest.createdAt,
    signedOutAt: null, latitude: 36, longitude: -83, accuracyMeters: 15,
    speedMetersPerSecond: 2, batteryLevel: 0.8, capturedAt: latest.capturedAt,
    receivedAt: latest.createdAt, status: "active",
  };
  const locations = combineDriverLocationSnapshots([mobile], [latest, older], Date.parse("2026-10-04T20:04:00.000Z"));
  assert.equal(locations.length, 2);
  assert.deepEqual(locations.find((row) => row.sessionId === mobile.sessionId), mobile);
  const browser = locations.find((row) => row.sessionId.startsWith("browser:"));
  assert.equal(browser?.latitude, 35);
  assert.equal(browser?.status, "active");
  assert.match(browser?.deviceLabel ?? "", /Browser.*Trailer 1/);
  assert.equal(combineDriverLocationSnapshots([], [latest], Date.parse("2026-10-04T20:10:00.000Z"))[0].status, "stale");
});

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
