export type TripPoint = {
  id: string; driverId: string; driverName: string; sessionId: string;
  source: "phone" | "browser"; vehicle: string | null; trailer: string | null;
  latitude: number; longitude: number; capturedAt: string;
  accuracyMeters: number | null; speedMetersPerSecond: number | null;
};
export type TripStop = {
  latitude: number; longitude: number; arrivedAt: string; lastObservedAt: string;
  departedAt: string | null; durationSeconds: number; ongoing: boolean;
};
export type DriverTrip = {
  id: string; driverId: string; driverName: string; source: TripPoint["source"];
  vehicle: string | null; trailer: string | null; startedAt: string; endedAt: string;
  segments: TripPoint[][]; stops: TripStop[]; distanceMiles: number; gapCount: number;
};
export const TRIP_GAP_MS = 5 * 60_000;
export const STOP_RADIUS_METERS = 60;
export const STOP_MINIMUM_MS = 2 * 60_000;

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = Math.PI / 180;
  const latitude = (b.latitude - a.latitude) * radians;
  const longitude = (b.longitude - a.longitude) * radians;
  const h = Math.sin(latitude / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(longitude / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function segmentStops(points: TripPoint[], now: number, mayBeOngoing: boolean): TripStop[] {
  const stops: TripStop[] = [];
  let candidate: TripPoint[] = [];
  function finish(departed: boolean) {
    if (candidate.length < 2) { candidate = []; return; }
    const first = candidate[0];
    const last = candidate[candidate.length - 1];
    const duration = Date.parse(last.capturedAt) - Date.parse(first.capturedAt);
    if (duration >= STOP_MINIMUM_MS) {
      stops.push({
        latitude: candidate.reduce((sum, point) => sum + point.latitude, 0) / candidate.length,
        longitude: candidate.reduce((sum, point) => sum + point.longitude, 0) / candidate.length,
        arrivedAt: first.capturedAt, lastObservedAt: last.capturedAt,
        departedAt: departed ? last.capturedAt : null,
        durationSeconds: Math.round(duration / 1000),
        ongoing: !departed && mayBeOngoing && now - Date.parse(last.capturedAt) <= TRIP_GAP_MS,
      });
    }
    candidate = [];
  }
  for (const point of points) {
    const moving = point.speedMetersPerSecond !== null && point.speedMetersPerSecond > 2.5;
    if (moving || (candidate.length && distanceMeters(candidate[0], point) > STOP_RADIUS_METERS)) finish(true);
    if (!moving) candidate.push(point);
  }
  finish(false);
  return stops;
}

export function buildDriverTrips(input: TripPoint[], now = Date.now()): { trips: DriverTrip[]; omittedPoints: number } {
  let omittedPoints = 0;
  const streams = new Map<string, TripPoint[]>();
  for (const point of input) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
      Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 ||
      !Number.isFinite(Date.parse(point.capturedAt)) || (point.accuracyMeters !== null && point.accuracyMeters > 100)) {
      omittedPoints++; continue;
    }
    const key = JSON.stringify([point.driverId, point.source, point.sessionId]);
    const stream = streams.get(key) ?? [];
    stream.push(point); streams.set(key, stream);
  }
  const trips: DriverTrip[] = [];
  for (const stream of streams.values()) {
    stream.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt) || a.id.localeCompare(b.id));
    let trip: DriverTrip | null = null;
    let previous: TripPoint | null = null;
    for (const point of stream) {
      if (previous && Date.parse(point.capturedAt) === Date.parse(previous.capturedAt)) continue;
      if (!trip || trip.vehicle !== point.vehicle || trip.trailer !== point.trailer) {
        trip = { id: `${point.source}:${point.sessionId}:${point.id}`, driverId: point.driverId, driverName: point.driverName,
          source: point.source, vehicle: point.vehicle, trailer: point.trailer,
          startedAt: point.capturedAt, endedAt: point.capturedAt, segments: [[]], stops: [], distanceMiles: 0, gapCount: 0 };
        trips.push(trip); previous = null;
      }
      if (previous) {
        const elapsed = Date.parse(point.capturedAt) - Date.parse(previous.capturedAt);
        const distance = distanceMeters(previous, point);
        if (elapsed <= TRIP_GAP_MS && distance / (elapsed / 1000) > 60) {
          omittedPoints++; trip.segments.push([]); trip.gapCount++; previous = null; continue;
        }
        if (elapsed > TRIP_GAP_MS) {
          trip.segments.push([]); trip.gapCount++;
        } else trip.distanceMiles += distance / 1609.344;
      }
      trip.segments[trip.segments.length - 1].push(point);
      trip.endedAt = point.capturedAt;
      previous = point;
    }
  }
  for (const trip of trips) {
    trip.segments = trip.segments.filter((segment) => segment.length > 0);
    trip.stops = trip.segments.flatMap((segment, index) => segmentStops(segment, now,
      index === trip.segments.length - 1 && !trips.some((later) => later.driverId === trip.driverId && later.source === trip.source && Date.parse(later.startedAt) > Date.parse(trip.endedAt))));
  }
  return { trips: trips.sort((a, b) => b.startedAt.localeCompare(a.startedAt)), omittedPoints };
}
