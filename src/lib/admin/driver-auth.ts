import { cookies } from "next/headers";
import {
  createAdminSessionValue,
  type AdminDeliveryAuthResult,
  type AdminIdentity,
  verifyAdminSessionValue,
} from "./delivery-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const DRIVER_SESSION_COOKIE = "jumpingjax-driver-session";
export const DRIVER_SHARED_PASSWORD = "password";
export const BUILT_IN_DRIVER_NAMES = ["Blake", "Jonathon"] as const;

type DriverNameRow = {
  delivery_driver: string | null;
  pickup_driver: string | null;
};

function normalizeDriverName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function driverId(name: string): string {
  return `driver:${normalizeDriverName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function collectKnownDriverNames(names: Iterable<string | null | undefined>): string[] {
  const known = new Map<string, string>();
  for (const name of names) {
    const clean = name?.trim().replace(/\s+/g, " ");
    const key = normalizeDriverName(clean);
    if (clean && key && !known.has(key)) {
      known.set(key, clean);
    }
  }

  return [...known.values()].sort((a, b) => a.localeCompare(b));
}

export function findKnownDriverName(
  username: string | null | undefined,
  names: Iterable<string | null | undefined>,
): string | null {
  const cleanUsername = normalizeDriverName(username);
  if (!cleanUsername) return null;

  return (
    collectKnownDriverNames(names).find(
      (name) => normalizeDriverName(name) === cleanUsername,
    ) ?? null
  );
}

export async function loadKnownDriverNames(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("booking_rental_items")
    .select("delivery_driver, pickup_driver")
    .or("delivery_driver.not.is.null,pickup_driver.not.is.null")
    .limit(5000)
    .returns<DriverNameRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const names = [...BUILT_IN_DRIVER_NAMES] as Array<
    string | null | undefined
  >;
  for (const row of data ?? []) {
    names.push(row.delivery_driver, row.pickup_driver);
  }

  return collectKnownDriverNames(names);
}

export async function verifyDriverLogin(input: {
  username: string | null | undefined;
  password: string | null | undefined;
}): Promise<AdminDeliveryAuthResult> {
  const cleanUsername = normalizeDriverName(input.username);
  const cleanPassword = input.password?.trim();
  if (!cleanUsername || cleanPassword !== DRIVER_SHARED_PASSWORD) {
    return { ok: false, reason: "invalid_token" };
  }

  const builtInDriverName = findKnownDriverName(cleanUsername, BUILT_IN_DRIVER_NAMES);
  const driverName =
    builtInDriverName ?? findKnownDriverName(cleanUsername, await loadKnownDriverNames());

  if (!driverName) {
    return { ok: false, reason: "invalid_token" };
  }

  return {
    ok: true,
    role: "employee",
    identity: {
      id: driverId(driverName),
      name: driverName,
      username: driverName,
      role: "employee",
    },
  };
}

export function createDriverSessionValue(identity: AdminIdentity): string | null {
  return createAdminSessionValue(identity);
}

export async function verifyDriverAccess(): Promise<AdminDeliveryAuthResult> {
  const cookieStore = await cookies();
  return verifyAdminSessionValue(cookieStore.get(DRIVER_SESSION_COOKIE)?.value);
}
