import { createServiceRoleClient } from "@/lib/supabase/admin";
import { facilityLocalDateTimeToUtc } from "@/lib/facility-parties/zoned-time";
import { isYmd } from "./delivery-planner-dates";
import { buildDriverTrips, type TripPoint } from "./driver-trip-history";

type HistoryRow = {
  id: string | number; session_id?: string; driver_id: string; driver_name: string;
  vehicle: string | null; trailer?: string | null; truck?: string | null;
  latitude: number; longitude: number; accuracy_meters: number | null;
  speed_meters_per_second: number | null; captured_at: string;
};
export function driverHistoryDayBounds(date: string) {
  if (!isYmd(date)) throw new Error("Choose a valid date.");
  const start = facilityLocalDateTimeToUtc(date, 0);
  const end = facilityLocalDateTimeToUtc(date, 1440);
  if (!start || !end) throw new Error("Choose a valid date.");
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function loadDriverTripHistory(input: { date: string; driverId?: string }) {
  const { start, end } = driverHistoryDayBounds(input.date);
  const supabase = createServiceRoleClient();
  async function read(source: "phone" | "browser"): Promise<TripPoint[]> {
    const points: TripPoint[] = [];
    const table = source === "phone" ? "driver_location_points" : "driver_location_snapshots";
    const fields = source === "phone" ? "session_id, trailer" : "truck";
    for (let offset = 0; offset < 100_000; offset += 1000) {
      let query = supabase.from(table)
        .select(`id, driver_id, driver_name, vehicle, latitude, longitude, accuracy_meters, speed_meters_per_second, captured_at, ${fields}`)
        .gte("captured_at", start).lt("captured_at", end)
        .order("captured_at").order("id");
      if (input.driverId) query = query.eq("driver_id", input.driverId);
      const { data, error } = await query.range(offset, offset + 999).returns<HistoryRow[]>();
      if (error) throw new Error("Driver route history could not be loaded.");
      points.push(...(data ?? []).map((row) => ({
        id: String(row.id), driverId: row.driver_id, driverName: row.driver_name,
        sessionId: source === "phone" ? row.session_id! : row.driver_id,
        source, vehicle: row.vehicle, trailer: source === "phone" ? row.trailer ?? null : row.truck ?? null,
        latitude: row.latitude, longitude: row.longitude, capturedAt: row.captured_at,
        accuracyMeters: row.accuracy_meters, speedMetersPerSecond: row.speed_meters_per_second,
      })));
      if ((data?.length ?? 0) < 1000) return points;
    }
    throw new Error("Too many locations for one view. Choose a driver to narrow this day.");
  }
  const [phone, browser] = await Promise.all([read("phone"), read("browser")]);
  return { date: input.date, ...buildDriverTrips([...phone, ...browser]) };
}
