import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isYmd } from "./delivery-planner-dates";

export type DriverLocationInput = {
  driverId: string;
  driverName: string;
  truck?: string | null;
  workDate?: string | null;
  latitude: unknown;
  longitude: unknown;
  accuracyMeters?: unknown;
  speedMetersPerSecond?: unknown;
  headingDegrees?: unknown;
  capturedAt?: unknown;
  userAgent?: string | null;
};

export type DriverLocationSnapshot = {
  id: string;
  driverId: string;
  driverName: string;
  truck: string | null;
  workDate: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMetersPerSecond: number | null;
  headingDegrees: number | null;
  capturedAt: string;
  createdAt: string;
};

type DriverLocationRow = {
  id: string;
  driver_id: string;
  driver_name: string;
  truck: string | null;
  work_date: string | null;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  speed_meters_per_second: number | null;
  heading_degrees: number | null;
  captured_at: string;
  created_at: string;
};

const MAX_DRIVER_ID_LENGTH = 160;
const MAX_DRIVER_NAME_LENGTH = 120;
const MAX_USER_AGENT_LENGTH = 240;
const MAX_CAPTURE_AGE_MS = 30 * 60 * 1000;
const MAX_CAPTURE_FUTURE_MS = 2 * 60 * 1000;

function isDriverLocationTruck(value: string): value is "truck-1" | "truck-2" {
  return value === "truck-1" || value === "truck-2";
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function optionalNonNegative(value: unknown): number | null {
  const number = finiteNumber(value);
  return number === null || number < 0 ? null : number;
}

function optionalHeading(value: unknown): number | null {
  const number = finiteNumber(value);
  return number === null || number < 0 || number > 360 ? null : number;
}

function parseCapturedAt(value: unknown, now = new Date()): string | null {
  const captured = typeof value === "string" ? new Date(value) : now;
  const timestamp = captured.getTime();
  if (!Number.isFinite(timestamp)) return null;
  if (timestamp < now.getTime() - MAX_CAPTURE_AGE_MS) return null;
  if (timestamp > now.getTime() + MAX_CAPTURE_FUTURE_MS) return null;
  return captured.toISOString();
}

export function validateDriverLocationInput(input: DriverLocationInput, now = new Date()) {
  const driverId = input.driverId.trim().slice(0, MAX_DRIVER_ID_LENGTH);
  const driverName = input.driverName
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_DRIVER_NAME_LENGTH);
  const latitude = finiteNumber(input.latitude);
  const longitude = finiteNumber(input.longitude);
  const capturedAt = parseCapturedAt(input.capturedAt, now);
  const truck = input.truck?.trim() || null;
  const workDate = input.workDate?.trim() || null;

  if (!driverId || !driverName) {
    return { ok: false as const, error: "Driver identity is required." };
  }
  if (latitude === null || latitude < -90 || latitude > 90) {
    return { ok: false as const, error: "Latitude is invalid." };
  }
  if (longitude === null || longitude < -180 || longitude > 180) {
    return { ok: false as const, error: "Longitude is invalid." };
  }
  if (truck !== null && !isDriverLocationTruck(truck)) {
    return { ok: false as const, error: "Truck is invalid." };
  }
  if (workDate !== null && !isYmd(workDate)) {
    return { ok: false as const, error: "Work date is invalid." };
  }
  if (!capturedAt) {
    return { ok: false as const, error: "Location timestamp is invalid." };
  }

  return {
    ok: true as const,
    value: {
      driver_id: driverId,
      driver_name: driverName,
      truck,
      work_date: workDate,
      latitude,
      longitude,
      accuracy_meters: optionalNonNegative(input.accuracyMeters),
      speed_meters_per_second: optionalNonNegative(input.speedMetersPerSecond),
      heading_degrees: optionalHeading(input.headingDegrees),
      captured_at: capturedAt,
      user_agent: input.userAgent?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
    },
  };
}

function rowToSnapshot(row: DriverLocationRow): DriverLocationSnapshot {
  return {
    id: row.id,
    driverId: row.driver_id,
    driverName: row.driver_name,
    truck: row.truck,
    workDate: row.work_date?.slice(0, 10) ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    speedMetersPerSecond: row.speed_meters_per_second,
    headingDegrees: row.heading_degrees,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
  };
}

export async function saveDriverLocationSnapshot(input: DriverLocationInput) {
  const parsed = validateDriverLocationInput(input);
  if (!parsed.ok) return parsed;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("driver_location_snapshots")
    .insert(parsed.value)
    .select(
      "id, driver_id, driver_name, truck, work_date, latitude, longitude, accuracy_meters, speed_meters_per_second, heading_degrees, captured_at, created_at",
    )
    .single<DriverLocationRow>();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, value: rowToSnapshot(data) };
}

export async function loadLatestDriverLocationSnapshots(input: {
  dates: string[];
}): Promise<DriverLocationSnapshot[]> {
  const dates = input.dates.filter(isYmd);
  if (dates.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("driver_location_snapshots")
    .select(
      "id, driver_id, driver_name, truck, work_date, latitude, longitude, accuracy_meters, speed_meters_per_second, heading_degrees, captured_at, created_at",
    )
    .in("work_date", dates)
    .gte("created_at", new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(80)
    .returns<DriverLocationRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const latest = new Map<string, DriverLocationRow>();
  for (const row of data ?? []) {
    const key = `${row.driver_id}:${row.truck ?? "none"}:${row.work_date ?? "none"}`;
    if (!latest.has(key)) latest.set(key, row);
  }

  return [...latest.values()].map(rowToSnapshot);
}
