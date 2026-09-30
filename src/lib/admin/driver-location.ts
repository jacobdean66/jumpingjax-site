import { createHash, randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isYmd } from "./delivery-planner-dates";
import { verifyDriverLogin } from "./driver-auth";

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

export type DriverMobileSession = {
  id: string;
  driverId: string;
  driverName: string;
  token: string;
};

type DriverLocationSessionRow = {
  id: string;
  driver_id: string;
  driver_name: string;
  device_label?: string | null;
  started_at?: string;
  last_seen_at?: string | null;
  signed_out_at: string | null;
};

type DriverLocationPointRow = {
  session_id: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  speed_meters_per_second: number | null;
  battery_level: number | null;
  captured_at: string | null;
  received_at: string | null;
};

export type DriverMobileLocationInput = {
  latitude: unknown;
  longitude: unknown;
  accuracyMeters?: unknown;
  altitudeMeters?: unknown;
  headingDegrees?: unknown;
  speedMetersPerSecond?: unknown;
  batteryLevel?: unknown;
  capturedAt?: string | null;
};

export type DriverMobileLocationSnapshot = {
  sessionId: string;
  driverId: string;
  driverName: string;
  deviceLabel: string | null;
  startedAt: string;
  lastSeenAt: string | null;
  signedOutAt: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  speedMetersPerSecond: number | null;
  batteryLevel: number | null;
  capturedAt: string | null;
  receivedAt: string | null;
  status: "active" | "stale" | "signed-out" | "no-location";
};

const MAX_DRIVER_ID_LENGTH = 160;
const MAX_DRIVER_NAME_LENGTH = 120;
const MAX_USER_AGENT_LENGTH = 240;
const MAX_CAPTURE_AGE_MS = 30 * 60 * 1000;
const MAX_CAPTURE_FUTURE_MS = 2 * 60 * 1000;

function isDriverLocationTruck(value: string): value is "truck-1" | "truck-2" {
  return value === "truck-1" || value === "truck-2";
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cleanOptional(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function validCapturedAt(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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

export async function createDriverMobileSession(input: {
  username: string | null | undefined;
  password: string | null | undefined;
  deviceId?: unknown;
  deviceLabel?: unknown;
}): Promise<DriverMobileSession | null> {
  const auth = await verifyDriverLogin({
    username: input.username,
    password: input.password,
  });
  if (!auth.ok) return null;

  const token = randomBytes(32).toString("base64url");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("driver_location_sessions")
    .insert({
      driver_id: auth.identity.id,
      driver_name: auth.identity.name,
      session_token_hash: hashSessionToken(token),
      device_id: cleanOptional(input.deviceId),
      device_label: cleanOptional(input.deviceLabel),
      last_seen_at: new Date().toISOString(),
    })
    .select("id, driver_id, driver_name")
    .single<Pick<DriverLocationSessionRow, "id" | "driver_id" | "driver_name">>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    driverId: data.driver_id,
    driverName: data.driver_name,
    token,
  };
}

export async function loadActiveDriverMobileSession(
  token: string | null | undefined,
): Promise<DriverLocationSessionRow | null> {
  const cleanToken = token?.trim();
  if (!cleanToken) return null;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("driver_location_sessions")
    .select("id, driver_id, driver_name, signed_out_at")
    .eq("session_token_hash", hashSessionToken(cleanToken))
    .is("signed_out_at", null)
    .maybeSingle<DriverLocationSessionRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function endDriverMobileSession(input: {
  token: string | null | undefined;
  reason?: string;
}): Promise<boolean> {
  const session = await loadActiveDriverMobileSession(input.token);
  if (!session) return false;

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("driver_location_sessions")
    .update({
      signed_out_at: new Date().toISOString(),
      sign_out_reason: input.reason?.trim() || "driver-sign-out",
    })
    .eq("id", session.id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function saveDriverLocationPoint(input: {
  token: string | null | undefined;
  location: DriverMobileLocationInput;
}): Promise<{ ok: true; driverName: string } | { ok: false; reason: string }> {
  const session = await loadActiveDriverMobileSession(input.token);
  if (!session) return { ok: false, reason: "invalid_session" };

  const latitude = finiteNumber(input.location.latitude);
  const longitude = finiteNumber(input.location.longitude);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { ok: false, reason: "invalid_location" };
  }

  const now = new Date().toISOString();
  const supabase = createServiceRoleClient();
  const point = await supabase.from("driver_location_points").insert({
    session_id: session.id,
    driver_id: session.driver_id,
    driver_name: session.driver_name,
    latitude,
    longitude,
    accuracy_meters: finiteNumber(input.location.accuracyMeters),
    altitude_meters: finiteNumber(input.location.altitudeMeters),
    heading_degrees: finiteNumber(input.location.headingDegrees),
    speed_meters_per_second: finiteNumber(input.location.speedMetersPerSecond),
    battery_level: finiteNumber(input.location.batteryLevel),
    captured_at: validCapturedAt(input.location.capturedAt),
  });

  if (point.error) {
    throw new Error(point.error.message);
  }

  const sessionUpdate = await supabase
    .from("driver_location_sessions")
    .update({ last_seen_at: now })
    .eq("id", session.id);

  if (sessionUpdate.error) {
    throw new Error(sessionUpdate.error.message);
  }

  return { ok: true, driverName: session.driver_name };
}

function mobileSnapshotStatus(args: {
  signedOutAt: string | null;
  receivedAt: string | null;
  now: number;
}): DriverMobileLocationSnapshot["status"] {
  if (args.signedOutAt) return "signed-out";
  if (!args.receivedAt) return "no-location";

  const received = new Date(args.receivedAt).getTime();
  if (!Number.isFinite(received)) return "no-location";
  return args.now - received > 5 * 60 * 1000 ? "stale" : "active";
}

export async function loadDriverMobileLocationSnapshots(
  limit = 25,
): Promise<DriverMobileLocationSnapshot[]> {
  const supabase = createServiceRoleClient();
  const sessionResult = await supabase
    .from("driver_location_sessions")
    .select(
      "id, driver_id, driver_name, device_label, started_at, last_seen_at, signed_out_at",
    )
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .limit(limit)
    .returns<DriverLocationSessionRow[]>();

  if (sessionResult.error) {
    throw new Error(sessionResult.error.message);
  }

  const sessions = sessionResult.data ?? [];
  const sessionIds = sessions.map((session) => session.id);
  const pointsBySession = new Map<string, DriverLocationPointRow>();

  if (sessionIds.length > 0) {
    const pointResult = await supabase
      .from("driver_location_points")
      .select(
        "session_id, latitude, longitude, accuracy_meters, speed_meters_per_second, battery_level, captured_at, received_at",
      )
      .in("session_id", sessionIds)
      .order("received_at", { ascending: false })
      .limit(sessionIds.length * 5)
      .returns<DriverLocationPointRow[]>();

    if (pointResult.error) {
      throw new Error(pointResult.error.message);
    }

    for (const point of pointResult.data ?? []) {
      if (!pointsBySession.has(point.session_id)) {
        pointsBySession.set(point.session_id, point);
      }
    }
  }

  const now = Date.now();
  return sessions.map((session) => {
    const point = pointsBySession.get(session.id);
    return {
      sessionId: session.id,
      driverId: session.driver_id,
      driverName: session.driver_name,
      deviceLabel: session.device_label ?? null,
      startedAt: session.started_at ?? "",
      lastSeenAt: session.last_seen_at ?? null,
      signedOutAt: session.signed_out_at,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      accuracyMeters: point?.accuracy_meters ?? null,
      speedMetersPerSecond: point?.speed_meters_per_second ?? null,
      batteryLevel: point?.battery_level ?? null,
      capturedAt: point?.captured_at ?? null,
      receivedAt: point?.received_at ?? null,
      status: mobileSnapshotStatus({
        signedOutAt: session.signed_out_at,
        receivedAt: point?.received_at ?? null,
        now,
      }),
    };
  });
}
