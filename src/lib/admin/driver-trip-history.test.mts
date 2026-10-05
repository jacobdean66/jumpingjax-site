import assert from "node:assert/strict";
import test from "node:test";
import { buildDriverTrips, distanceMeters, type TripPoint } from "./driver-trip-history";
import { driverHistoryDayBounds } from "./driver-trip-history-data";

function point(minute: number, changes: Partial<TripPoint> = {}): TripPoint {
  return { id: String(minute), sessionId: "synthetic-session", driverId: "driver:test", driverName: "Test Driver", source: "phone",
    vehicle: "dodge", trailer: "truck-1", latitude: 34.195, longitude: -82.16,
    capturedAt: new Date(Date.UTC(2026, 9, 5, 14, minute)).toISOString(), accuracyMeters: 15, speedMetersPerSecond: 0, ...changes };
}
test("stationary GPS jitter produces one timed stop, with an observed departure", () => {
  const result = buildDriverTrips([point(0), point(1, { latitude: 34.1951 }), point(2), point(3), point(4, { latitude: 34.198, speedMetersPerSecond: 5 })]);
  assert.equal(result.trips.length, 1);
  assert.equal(result.trips[0].stops.length, 1);
  const stop = result.trips[0].stops[0];
  assert.equal(stop.arrivedAt, point(0).capturedAt);
  assert.equal(stop.durationSeconds, 180);
  assert.equal(stop.departedAt, point(3).capturedAt);
  assert.ok(result.trips[0].distanceMiles > 0.1);
});
test("short pauses and driving around inside the stop radius are not counted as stops", () => {
  assert.equal(buildDriverTrips([point(0), point(1), point(2, { latitude: 34.198 })]).trips[0].stops.length, 0);
  assert.equal(buildDriverTrips([point(0, { speedMetersPerSecond: 5 }), point(1, { speedMetersPerSecond: 5 }), point(2, { speedMetersPerSecond: 5 })]).trips[0].stops.length, 0);
});
test("missing GPS does not fabricate a route or dwell time across the gap", () => {
  const trip = buildDriverTrips([point(0), point(1), point(15), point(16)]).trips[0];
  assert.equal(trip.gapCount, 1);
  assert.equal(trip.segments.length, 2);
  assert.equal(trip.stops.length, 0);
  assert.equal(trip.distanceMiles, 0);
});
test("changing truck or trailer splits the history while preserving the earlier labels", () => {
  const result = buildDriverTrips([point(0), point(1), point(2, { vehicle: "ford" }), point(3, { vehicle: "ford", trailer: "truck-2" })]);
  assert.equal(result.trips.length, 3);
  assert.deepEqual(result.trips.map((trip) => [trip.vehicle, trip.trailer]).reverse(), [["dodge", "truck-1"], ["ford", "truck-1"], ["ford", "truck-2"]]);
});
test("different drivers, phone sessions, and browser streams never share a route", () => {
  const result = buildDriverTrips([point(0), point(1, { driverId: "driver:other" }), point(2, { sessionId: "second" }), point(3, { source: "browser" })]);
  assert.equal(result.trips.length, 4);
});
test("historical points without equipment stay unknown rather than using current equipment", () => {
  const trip = buildDriverTrips([point(0, { vehicle: null, trailer: null }), point(1, { vehicle: "ford" })]);
  assert.equal(trip.trips.length, 2);
  assert.equal(trip.trips[1].vehicle, null);
  assert.equal(trip.trips[1].trailer, null);
});
test("inaccurate updates and implausible jumps are omitted, not plotted as travel", () => {
  const result = buildDriverTrips([point(0), point(1, { latitude: 45, accuracyMeters: 500 }), point(2, { latitude: 45 }), point(3), point(4)]);
  assert.equal(result.omittedPoints, 2);
  assert.ok(result.trips[0].segments.flat().every((p) => p.latitude < 35));
});
test("duplicates, unordered samples, and one-point trips remain usable", () => {
  const trip = buildDriverTrips([point(2), point(0), point(1), point(1)]).trips[0];
  assert.equal(trip.segments.flat().length, 3);
  assert.equal(trip.stops[0].durationSeconds, 120);
  assert.equal(buildDriverTrips([point(0)]).trips[0].stops.length, 0);
});
test("stop ongoing status requires a recent observation and ends with an equipment switch", () => {
  const samples = [point(0), point(1), point(2)];
  assert.equal(buildDriverTrips(samples, Date.parse(point(3).capturedAt)).trips[0].stops[0].ongoing, true);
  assert.equal(buildDriverTrips(samples, Date.parse(point(20).capturedAt)).trips[0].stops[0].ongoing, false);
  const switched = buildDriverTrips([...samples, point(3, { vehicle: "ford" })], Date.parse(point(4).capturedAt));
  assert.equal(switched.trips[1].stops[0].ongoing, false);
});
test("Eastern day boundaries include late evenings and DST transitions correctly", () => {
  assert.deepEqual(driverHistoryDayBounds("2026-10-05"), { start: "2026-10-05T04:00:00.000Z", end: "2026-10-06T04:00:00.000Z" });
  const spring = driverHistoryDayBounds("2026-03-08");
  const fall = driverHistoryDayBounds("2026-11-01");
  assert.equal((Date.parse(spring.end) - Date.parse(spring.start)) / 3600000, 23);
  assert.equal((Date.parse(fall.end) - Date.parse(fall.start)) / 3600000, 25);
  assert.throws(() => driverHistoryDayBounds("2026-02-30"));
  assert.ok(distanceMeters(point(0), point(0, { latitude: 34.196 })) > 100);
});
